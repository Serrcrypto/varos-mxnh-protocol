// ============================================================
// src/payments/stripe.ts
// Módulo de Stripe Connect para el protocolo Varos.
// Modelo de PLATAFORMA: Varos es la plataforma, las fintechs son
// "cuentas conectadas" (sub-comercios) que procesan pagos a través nuestro.
// ============================================================

import Stripe from "stripe";

// Inicializar Stripe con la llave secreta del .env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ─── CREAR CUENTA CONECTADA ─────────────────────────────────────────────────
// Cada fintech que integra el protocolo MXNH se registra como una
// "Connected Account" en Stripe. Esto permite que Varos procese pagos
// en nombre de la fintech.
// Tipo "express" = Stripe maneja el onboarding KYC de la fintech.
export async function createConnectedAccount(
  fintechName: string,
  email: string,
): Promise<{ accountId: string; onboardingUrl: string }> {
  try {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email,
      business_type: "company",
      metadata: {
        fintechName,
        protocol: "varos-mxnh",
      },
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.APP_URL || "http://localhost:3000"}/payments/onboarding-refresh`,
      return_url: `${process.env.APP_URL || "http://localhost:3000"}/payments/onboarding-complete`,
      type: "account_onboarding",
    });

    return {
      accountId: account.id,
      onboardingUrl: accountLink.url,
    };
  } catch (error) {
    console.error("❌ Error creando cuenta conectada:", error);
    throw error;
  }
}

// ─── CREAR PAYMENT INTENT ───────────────────────────────────────────────────
// Crea una intención de pago en USD a través de la plataforma.
// El dinero entra a Varos (plataforma) → luego se mintea MXNH equivalente.
//
// Soporta dos modos:
// 1. CON cuenta conectada (Stripe Connect) → para fintechs reales en producción
// 2. SIN cuenta conectada → para la app de referencia / demo del hackathon
//
// El fee del protocolo (0.5%) se cobra en Hedera vía CustomFractionalFee,
// no en Stripe. Por eso application_fee_amount = 0.
export async function createPaymentIntent(
  amountUsd: number,
  metadata: {
    receiverPhone: string;
    sdkClientId: string;
    connectedAccountId?: string; // Opcional: si no hay, pago directo a la plataforma
  },
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  try {
    const amountInCents = Math.round(amountUsd * 100);

    // Construir params base
    const params: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency: "usd",
      metadata: {
        receiverPhone: metadata.receiverPhone,
        sdkClientId: metadata.sdkClientId,
        protocol: "varos-mxnh",
      },
    };

    // Solo agregar Connect (fee + destino) si hay cuenta conectada
    // Sin cuenta conectada = pago directo a Varos (modo demo/app de referencia)
    if (metadata.connectedAccountId) {
      params.application_fee_amount = 0;
      params.transfer_data = {
        destination: metadata.connectedAccountId,
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(params);

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error("❌ Error creando PaymentIntent:", error);
    throw error;
  }
}

// ─── VERIFICAR FIRMA DEL WEBHOOK ────────────────────────────────────────────
// Stripe firma cada webhook con STRIPE_WEBHOOK_SECRET para que podamos
// verificar que el evento realmente viene de Stripe y no de un atacante.
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}
