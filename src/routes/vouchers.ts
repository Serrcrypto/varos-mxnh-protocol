// ============================================================
// src/routes/vouchers.ts
// Endpoints para gestión de vouchers de cobro en OXXO y SPEI.
//
// Flujo completo:
// 1. Se mintea MXNH → se crea voucher → se envía SMS al receptor
// 2. Receptor consulta GET /voucher/:code para ver su monto
// 3. Receptor cobra POST /voucher/:code/redeem → se genera pago OXXO,
//    se quema MXNH en Hedera, se registra en HCS
// ============================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createVoucher, getVoucher, redeemVoucher } from "../services/voucher";
import { mintMXNH, burnMXNH } from "../hedera/token";
import { logTransaction } from "../hedera/hcs";
import { generateOxxoPayment, generateSpeiTransfer } from "../payments/conekta";
import { sendPaymentNotification } from "../notifications/twilio";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface CreateVoucherBody {
  amountMxnh: number;      // Monto del voucher en MXNH
  receiverPhone: string;   // Teléfono del receptor (+52...)
}

interface RedeemBody {
  offRampType: "OXXO" | "SPEI";  // Método de cobro
  clabe?: string;                  // CLABE destino (solo para SPEI)
}

interface VoucherParams {
  code: string;  // Código del voucher (ABCD-EFGH-IJKL-MNOP)
}

export default async function voucherRoutes(server: FastifyInstance) {

  // ─── POST /voucher/create ─────────────────────────────────────────────────
  // Crea un voucher después de un minteo exitoso.
  // Mintea MXNH, genera el código, y envía SMS al receptor.
  // Protegido con x-api-key.
  server.post<{ Body: CreateVoucherBody }>(
    "/voucher/create",
    async (request, reply) => {
      try {
        // Verificar API key
        const apiKey = request.headers["x-api-key"];
        if (!apiKey || apiKey !== process.env.TEST_API_KEY) {
          return reply.status(401).send({
            success: false,
            error: "No autorizado. x-api-key inválida o ausente.",
          });
        }

        const { amountMxnh, receiverPhone } = request.body;

        if (!amountMxnh || amountMxnh <= 0) {
          return reply.status(400).send({ error: "amountMxnh debe ser mayor a 0" });
        }
        if (!receiverPhone) {
          return reply.status(400).send({ error: "receiverPhone es requerido" });
        }

        // 1. Mintear MXNH en Hedera
        const txId = await mintMXNH(amountMxnh);
        const feeValue = parseFloat((amountMxnh * 0.005).toFixed(2));

        // 2. Registrar en HCS con ISO 20022
        const hcsSequence = await logTransaction({
          MsgType: "MINT",
          InstdAmt: { value: amountMxnh, currency: "MXN" },
          DbtrAcct: process.env.HEDERA_TREASURY_ID || null,
          CdtrAcct: process.env.HEDERA_TREASURY_ID || null,
          TxRef: txId,
          PrtclFee: {
            value: feeValue,
            collector: process.env.HEDERA_FEE_COLLECTOR_ID!,
          },
        });

        // 3. Crear el voucher
        const voucher = createVoucher(amountMxnh, receiverPhone, txId, hcsSequence);

        // 4. Enviar SMS al receptor (no falla si Twilio tiene límite)
        try {
          await sendPaymentNotification(receiverPhone, amountMxnh, voucher.code);
        } catch (smsError) {
          console.warn("⚠️ SMS no enviado (límite trial o error):", smsError);
        }

        return {
          success: true,
          message: "Voucher creado y SMS enviado al receptor",
          data: {
            voucherCode: voucher.code,
            amountMxnh: voucher.amountMxnh,
            expiresAt: voucher.expiresAt,
            transactionId: txId,
            hcsSequence,
          },
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ success: false, error: error.message });
      }
    },
  );

  // ─── GET /voucher/:code ───────────────────────────────────────────────────
  // Consulta pública — el receptor verifica su voucher con el código del SMS.
  // No requiere autenticación (el código ES la autenticación).
  server.get<{ Params: VoucherParams }>(
    "/voucher/:code",
    async (request, reply) => {
      try {
        const { code } = request.params;
        const voucher = getVoucher(code);

        if (!voucher) {
          return reply.status(404).send({
            success: false,
            error: "Voucher no encontrado. Verifica el código.",
          });
        }

        return {
          success: true,
          data: {
            code: voucher.code,
            amountMxnh: voucher.amountMxnh,
            status: voucher.status,
            expiresAt: voucher.expiresAt,
            createdAt: voucher.createdAt,
            // Solo mostrar detalles de cobro si ya fue redimido
            ...(voucher.status === "REDEEMED" && {
              redeemedAt: voucher.redeemedAt,
              offRampType: voucher.offRampType,
            }),
          },
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ success: false, error: error.message });
      }
    },
  );

  // ─── POST /voucher/:code/redeem ───────────────────────────────────────────
  // El receptor cobra su voucher. Flujo:
  // 1. Verificar que el voucher es válido y está ACTIVE
  // 2. Generar pago en OXXO (o transferencia SPEI)
  // 3. Quemar los MXNH correspondientes en Hedera
  // 4. Registrar la quema en HCS con ISO 20022
  // 5. Marcar voucher como REDEEMED
  server.post<{ Params: VoucherParams; Body: RedeemBody }>(
    "/voucher/:code/redeem",
    async (request, reply) => {
      try {
        const { code } = request.params;
        const { offRampType, clabe } = request.body;

        // 1. Verificar voucher
        const voucher = getVoucher(code);

        if (!voucher) {
          return reply.status(404).send({
            success: false,
            error: "Voucher no encontrado.",
          });
        }

        if (voucher.status === "REDEEMED") {
          return reply.status(400).send({
            success: false,
            error: "Este voucher ya fue cobrado.",
          });
        }

        if (voucher.status === "EXPIRED") {
          return reply.status(400).send({
            success: false,
            error: "Este voucher ha expirado.",
          });
        }

        if (!offRampType || !["OXXO", "SPEI"].includes(offRampType)) {
          return reply.status(400).send({
            error: "offRampType debe ser 'OXXO' o 'SPEI'",
          });
        }

        if (offRampType === "SPEI" && !clabe) {
          return reply.status(400).send({
            error: "clabe es requerida para cobro SPEI",
          });
        }

        // 2. Generar el pago en el off-ramp correspondiente
        let offRampReference = "";

        if (offRampType === "OXXO") {
          const oxxoResult = await generateOxxoPayment(
            voucher.amountMxnh,
            voucher.receiverPhone
          );
          offRampReference = oxxoResult.reference;
          console.log(`🏪 Referencia OXXO: ${oxxoResult.reference}`);
        } else {
          const speiResult = await generateSpeiTransfer(
            voucher.amountMxnh,
            clabe!
          );
          offRampReference = speiResult.trackingId;
          console.log(`🏦 Transferencia SPEI: ${speiResult.trackingId}`);
        }

        // 3. Quemar MXNH en Hedera (el dinero ya fue entregado al receptor)
        const burnTxId = await burnMXNH(voucher.amountMxnh);
        const feeValue = parseFloat((voucher.amountMxnh * 0.005).toFixed(2));

        // 4. Registrar quema en HCS con ISO 20022
        const hcsSequence = await logTransaction({
          MsgType: "BURN",
          InstdAmt: { value: voucher.amountMxnh, currency: "MXN" },
          DbtrAcct: process.env.HEDERA_TREASURY_ID || null,
          CdtrAcct: null, // Se queman, no van a nadie
          TxRef: burnTxId,
          PrtclFee: {
            value: feeValue,
            collector: process.env.HEDERA_FEE_COLLECTOR_ID!,
          },
        });

        // 5. Marcar voucher como cobrado
        redeemVoucher(code, offRampType, offRampReference);

        return {
          success: true,
          message: `Voucher cobrado exitosamente vía ${offRampType}`,
          data: {
            voucherCode: code,
            amountMxnh: voucher.amountMxnh,
            offRampType,
            offRampReference,
            burnTransactionId: burnTxId,
            hcsSequence,
          },
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ success: false, error: error.message });
      }
    },
  );
}
