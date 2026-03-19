// ============================================================
// src/routes/payments.ts
// Endpoints para el on-ramp USD → MXNH vía Stripe Connect.
// Flujo: Fintech cobra USD → Webhook confirma pago → Se mintea MXNH
// ============================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createConnectedAccount,
  createPaymentIntent,
  constructWebhookEvent,
} from "../payments/stripe";
import { mintMXNH } from "../hedera/token";
import { logTransaction } from "../hedera/hcs";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface CreateIntentBody {
  amountUsd: number;          // Monto en dólares que paga el emisor
  receiverPhone: string;      // Teléfono del receptor en México (+52...)
  sdkClientId: string;        // ID de la fintech que originó la transacción
  connectedAccountId: string; // Cuenta Stripe Connect de la fintech
}

interface CreateAccountBody {
  fintechName: string;  // Nombre de la fintech
  email: string;        // Email de la fintech
}

export default async function paymentRoutes(server: FastifyInstance) {

  // ─── POST /payments/create-account ──────────────────────────────────────
  // Registra una nueva fintech como cuenta conectada en Stripe.
  // Devuelve el accountId y un link para que la fintech complete su KYC.
  server.post<{ Body: CreateAccountBody }>(
    "/payments/create-account",
    async (request, reply) => {
      try {
        const { fintechName, email } = request.body;

        if (!fintechName || !email) {
          return reply.status(400).send({ error: "fintechName y email son requeridos" });
        }

        const result = await createConnectedAccount(fintechName, email);

        return {
          success: true,
          message: "Cuenta conectada creada. La fintech debe completar el onboarding.",
          data: result,
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ success: false, error: error.message });
      }
    },
  );

  // ─── POST /payments/create-intent ───────────────────────────────────────
  // Crea un PaymentIntent para cobrar USD al emisor.
  // El frontend usa el clientSecret devuelto para mostrar el formulario de pago.
  server.post<{ Body: CreateIntentBody }>(
    "/payments/create-intent",
    async (request, reply) => {
      try {
        const { amountUsd, receiverPhone, sdkClientId, connectedAccountId } = request.body;

        if (!amountUsd || amountUsd <= 0) {
          return reply.status(400).send({ error: "amountUsd debe ser mayor a 0" });
        }

        if (!receiverPhone || !sdkClientId || !connectedAccountId) {
          return reply.status(400).send({
            error: "receiverPhone, sdkClientId y connectedAccountId son requeridos",
          });
        }

        const result = await createPaymentIntent(amountUsd, {
          receiverPhone,
          sdkClientId,
          connectedAccountId,
        });

        return {
          success: true,
          message: "PaymentIntent creado. Usa clientSecret en el frontend.",
          data: result,
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ success: false, error: error.message });
      }
    },
  );

  // ─── POST /payments/webhook ─────────────────────────────────────────────
  // Stripe envía eventos aquí cuando algo pasa con un pago.
  // Cuando payment_intent.succeeded:
  //   1. Calcula MXNH equivalente (tipo de cambio fijo 17.5 por ahora)
  //   2. Mintea MXNH en Hedera
  //   3. Registra en HCS con ISO 20022
  //
  // IMPORTANTE: Este endpoint NO debe tener el middleware de x-api-key
  // porque Stripe lo llama directamente. La autenticación es vía firma
  // del webhook (stripe-signature header).
  server.post(
    "/payments/webhook",
    {
      // Fastify parsea el body como JSON por defecto, pero Stripe necesita
      // el body RAW (sin parsear) para verificar la firma del webhook.
      config: { rawBody: true },
    },
    async (request, reply) => {
      try {
        // Obtener el body raw y la firma que Stripe envía en el header
        const signature = request.headers["stripe-signature"] as string;
        const rawBody = (request as any).rawBody || JSON.stringify(request.body);

        if (!signature) {
          return reply.status(400).send({ error: "Falta header stripe-signature" });
        }

        // Verificar que el evento realmente viene de Stripe (no de un atacante)
        const event = constructWebhookEvent(rawBody, signature);

        // Solo nos interesa cuando el pago fue EXITOSO
        if (event.type === "payment_intent.succeeded") {
          const paymentIntent = event.data.object as any;

          // Extraer datos del metadata que pusimos al crear el PaymentIntent
          const amountUsd = paymentIntent.amount / 100; // De centavos a dólares
          const receiverPhone = paymentIntent.metadata?.receiverPhone;
          const sdkClientId = paymentIntent.metadata?.sdkClientId;

          // ─── TIPO DE CAMBIO ──────────────────────────────────────────
          // Por ahora fijo a 17.5 MXN/USD. En la Etapa 4 lo conectaremos
          // al oracle de Chainlink para tener tipo de cambio real.
          const exchangeRate = 17.5;
          const amountMxnh = parseFloat((amountUsd * exchangeRate).toFixed(2));

          console.log(`💰 Pago recibido: $${amountUsd} USD → ${amountMxnh} MXNH`);
          console.log(`📱 Receptor: ${receiverPhone}`);

          // 1. Mintear MXNH equivalente en Hedera
          const txId = await mintMXNH(
            amountMxnh,
            process.env.HEDERA_TREASURY_ID // Los MXNH van a Tesorería por ahora
          );

          // 2. Calcular fee del protocolo para el registro HCS
          const feeValue = parseFloat((amountMxnh * 0.005).toFixed(2));

          // 3. Registrar en HCS con estructura ISO 20022
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

          console.log(`✅ MXNH minteado: ${txId} | HCS Seq: ${hcsSequence}`);
        }

        // Stripe espera un 200 para confirmar que recibimos el evento
        return reply.status(200).send({ received: true });
      } catch (error: any) {
        server.log.error(error);
        // 400 le dice a Stripe que reintente más tarde
        return reply.status(400).send({ error: error.message });
      }
    },
  );
}
