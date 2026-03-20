// ============================================================
// src/routes/offramp.ts
// Endpoints dedicados para off-ramp: convertir MXNH → pesos mexicanos.
// SPEI = transferencia bancaria instantánea en México.
//
// Flujo:
// 1. Receptor tiene un voucher ACTIVE con MXNH
// 2. Envía su CLABE (cuenta bancaria) + código de voucher
// 3. Se valida la CLABE (18 dígitos) y el voucher
// 4. Se genera transferencia SPEI vía STP (mock para MVP)
// 5. Se queman los MXNH en Hedera y se registra en HCS
// ============================================================

import { FastifyInstance } from "fastify";
import { getVoucher, redeemVoucher } from "../services/voucher";
import { burnMXNH } from "../hedera/token";
import { logTransaction } from "../hedera/hcs";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface SpeiBody {
  voucherCode: string; // Código del voucher (ABCD-EFGH-IJKL-MNOP)
  clabe: string;       // CLABE interbancaria del receptor (18 dígitos)
}

// ─── MOCK DE STP (Sistema de Transferencias y Pagos) ────────────────────────
// STP es el operador de SPEI en México. En producción se conecta a su API.
// Para el MVP simulamos la respuesta.
interface StpTransferResult {
  success: boolean;
  clabe: string;
  reference: string;
  trackingKey: string; // Clave de rastreo SPEI (formato real: 16 dígitos)
  amountMxn: number;
  status: "LIQUIDADA" | "EN_PROCESO" | "DEVUELTA";
}

async function sendSpeiViaStp(
  amountMxn: number,
  destinationClabe: string,
  concept: string
): Promise<StpTransferResult> {
  console.log(`🏦 [MOCK STP] Transferencia SPEI:`);
  console.log(`   Monto: $${amountMxn} MXN`);
  console.log(`   CLABE destino: ${destinationClabe}`);
  console.log(`   Concepto: ${concept}`);

  // Simular latencia de STP (300-800ms en producción)
  await new Promise((resolve) => setTimeout(resolve, 400));

  // Clave de rastreo SPEI: 16 dígitos (formato real)
  const trackingKey = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 10)
  ).join("");

  return {
    success: true,
    clabe: destinationClabe,
    reference: `VAROS-${Date.now().toString().slice(-8)}`,
    trackingKey,
    amountMxn,
    status: "LIQUIDADA", // En mock siempre es exitosa
  };
}

// ─── VALIDAR CLABE ──────────────────────────────────────────────────────────
// La CLABE interbancaria mexicana tiene exactamente 18 dígitos numéricos.
// Estructura: [3 banco][3 plaza][11 cuenta][1 dígito verificador]
function validateClabe(clabe: string): { valid: boolean; error?: string } {
  // Quitar espacios por si el usuario los puso
  const cleaned = clabe.replace(/\s/g, "");

  if (!cleaned) {
    return { valid: false, error: "CLABE es requerida" };
  }

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: "CLABE solo debe contener números" };
  }

  if (cleaned.length !== 18) {
    return {
      valid: false,
      error: `CLABE debe tener 18 dígitos, se recibieron ${cleaned.length}`,
    };
  }

  return { valid: true };
}

// ─── RUTAS ──────────────────────────────────────────────────────────────────

export default async function offrampRoutes(server: FastifyInstance) {

  // ─── POST /offramp/spei ─────────────────────────────────────────────────
  // Cobra un voucher vía transferencia SPEI a la CLABE del receptor.
  // No requiere x-api-key porque el código del voucher ES la autenticación.
  server.post<{ Body: SpeiBody }>(
    "/offramp/spei",
    async (request, reply) => {
      try {
        const { voucherCode, clabe } = request.body;

        // 1. Validar que se envió el código
        if (!voucherCode) {
          return reply.status(400).send({
            success: false,
            error: "voucherCode es requerido",
          });
        }

        // 2. Validar CLABE (18 dígitos, solo números)
        const clabeValidation = validateClabe(clabe);
        if (!clabeValidation.valid) {
          return reply.status(400).send({
            success: false,
            error: clabeValidation.error,
          });
        }

        // 3. Verificar voucher válido y activo
        const voucher = getVoucher(voucherCode);

        if (!voucher) {
          return reply.status(404).send({
            success: false,
            error: "Voucher no encontrado. Verifica el código.",
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

        // 4. Enviar transferencia SPEI vía STP (mock)
        const speiResult = await sendSpeiViaStp(
          voucher.amountMxnh,
          clabe.replace(/\s/g, ""),
          `Varos MXNH - Voucher ${voucherCode}`
        );

        if (!speiResult.success) {
          return reply.status(500).send({
            success: false,
            error: "Error al procesar la transferencia SPEI",
          });
        }

        // 5. Quemar MXNH en Hedera (el dinero ya fue enviado al receptor)
        const burnTxId = await burnMXNH(voucher.amountMxnh);
        const feeValue = parseFloat((voucher.amountMxnh * 0.005).toFixed(2));

        // 6. Registrar quema en HCS con estructura ISO 20022
        const hcsSequence = await logTransaction({
          MsgType: "BURN",
          InstdAmt: { value: voucher.amountMxnh, currency: "MXN" },
          DbtrAcct: process.env.HEDERA_TREASURY_ID || null,
          CdtrAcct: null, // Se queman, el dinero ya salió vía SPEI
          TxRef: burnTxId,
          PrtclFee: {
            value: feeValue,
            collector: process.env.HEDERA_FEE_COLLECTOR_ID!,
          },
        });

        // 7. Marcar voucher como cobrado
        redeemVoucher(voucherCode, "SPEI", speiResult.trackingKey);

        return {
          success: true,
          message: "Transferencia SPEI procesada exitosamente",
          data: {
            voucherCode,
            amountMxn: voucher.amountMxnh,
            clabe: speiResult.clabe,
            trackingKey: speiResult.trackingKey,
            reference: speiResult.reference,
            status: speiResult.status,
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
