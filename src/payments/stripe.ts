// ============================================================
// src/payments/stripe.ts
// Módulo de Stripe Connect para el protocolo Varos.
// Modelo de PLATAFORMA: Varos es la plataforma, las fintechs son
// "cuentas conectadas" (sub-comercios) que procesan pagos a través nuestro.
// ============================================================

import Stripe from "stripe";

// Inicializar Stripe con la llave secreta del .env
// apiVersion fija para evitar que cambios de Stripe rompan el código
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
    // 1. Crear la cuenta conectada en Stripe
    const account = await stripe.accounts.create({
      type: "express", // Express = Stripe se encarga del KYC de la fintech
      country: "US", // País de la plataforma (Varos opera desde US)
      email,
      business_type: "company",
      metadata: {
        fintechName, // Nombre de la fintech para referencia interna
        protocol: "varos-mxnh", // Identificador del protocolo
      },
    });

    // 2. Generar link de onboarding para que la fintech complete su KYC en Stripe
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.APP_URL || "http://localhost:3000"}/payments/onboarding-refresh`,
      return_url: `${process.env.APP_URL || "http://localhost:3000"}/payments/onboarding-complete`,
      type: "account_onboarding",
    });

    return {
      accountId: account.id, // ej: "acct_1R..."
      onboardingUrl: accountLink.url, // URL donde la fintech completa su registro
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
// IMPORTANTE: application_fee_amount = 0 porque el fee del protocolo (0.5%)
// se cobra automáticamente en Hedera vía el CustomFractionalFee del token HTS.
// No cobramos doble fee.
export async function createPaymentIntent(
  amountUsd: number,
  metadata: {
    receiverPhone: string; // Teléfono del receptor en México
    sdkClientId: string; // ID de la fintech que originó la transacción
    connectedAccountId: string; // Cuenta conectada de la fintech en Stripe
  },
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  try {
    // Stripe maneja montos en centavos: $50.00 USD = 5000
    const amountInCents = Math.round(amountUsd * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      // application_fee_amount: 0 → el fee se cobra en Hedera, no en Stripe
      application_fee_amount: 0,
      // El pago se procesa a través de la cuenta conectada de la fintech
      transfer_data: {
        destination: metadata.connectedAccountId,
      },
      metadata: {
        receiverPhone: metadata.receiverPhone,
        sdkClientId: metadata.sdkClientId,
        protocol: "varos-mxnh",
      },
    });

    return {
      clientSecret: paymentIntent.client_secret!, // El frontend usa esto para confirmar el pago
      paymentIntentId: paymentIntent.id, // ej: "pi_3R..."
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
