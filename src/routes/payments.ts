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
import { processPayment } from "../services/varos";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface CreateIntentBody {
  amountUsd: number; // Monto en dólares que paga el emisor
  receiverPhone: string; // Teléfono del receptor en México (+52...)
  sdkClientId: string; // ID de la fintech que originó la transacción
  connectedAccountId: string; // Cuenta Stripe Connect de la fintech
}

interface CreateAccountBody {
  fintechName: string; // Nombre de la fintech
  email: string; // Email de la fintech
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
          return reply
            .status(400)
            .send({ error: "fintechName y email son requeridos" });
        }

        const result = await createConnectedAccount(fintechName, email);

        return {
          success: true,
          message:
            "Cuenta conectada creada. La fintech debe completar el onboarding.",
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
  // Acepta formato del frontend { amount, currency } o formato completo
  // { amountUsd, receiverPhone, sdkClientId, connectedAccountId }
  server.post("/payments/create-intent", async (request, reply) => {
    try {
      const body = request.body as any;

      // Aceptar ambos formatos: { amount (cents) } o { amountUsd }
      let amountUsd: number;
      if (body.amountUsd) {
        amountUsd = body.amountUsd;
      } else if (body.amount) {
        amountUsd = body.amount / 100; // Convertir de centavos a dólares
      } else {
        return reply
          .status(400)
          .send({ error: "amount o amountUsd es requerido" });
      }

      if (amountUsd <= 0) {
        return reply.status(400).send({ error: "El monto debe ser mayor a 0" });
      }

      // Campos opcionales para el frontend de la app de referencia
      const receiverPhone = body.receiverPhone || "+520000000000";
      const sdkClientId = body.sdkClientId || "app-demo";
      const connectedAccountId = body.connectedAccountId || undefined;

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
  });

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
  //
  // Ahora usa el orquestador varos.ts para ejecutar el flujo completo.
  server.post(
    "/payments/webhook",
    {
      config: { rawBody: true },
    },
    async (request, reply) => {
      try {
        const signature = request.headers["stripe-signature"] as string;
        const rawBody =
          (request as any).rawBody || JSON.stringify(request.body);

        if (!signature) {
          return reply
            .status(400)
            .send({ error: "Falta header stripe-signature" });
        }

        const event = constructWebhookEvent(rawBody, signature);

        if (event.type === "payment_intent.succeeded") {
          const paymentIntent = event.data.object as any;

          const amountUsd = paymentIntent.amount / 100;
          const receiverPhone =
            paymentIntent.metadata?.receiverPhone || "+520000000000";
          const sdkClientId = paymentIntent.metadata?.sdkClientId;

          // Usar el orquestador para ejecutar TODO el flujo
          const result = await processPayment({
            amountUsd,
            receiverPhone,
            sdkClientId,
            stripePaymentIntentId: paymentIntent.id,
          });

          if (!result.success) {
            console.error(`❌ Flujo falló en paso: ${result.failedStep}`);
          }
        }

        return reply.status(200).send({ received: true });
      } catch (error: any) {
        server.log.error(error);
        return reply.status(400).send({ error: error.message });
      }
    },
  );
}
