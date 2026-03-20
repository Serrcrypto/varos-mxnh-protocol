// ============================================================
// src/payments/conekta.ts
// Mock de la API de Conekta para generar pagos en OXXO.
//
// En producción: Conekta genera una "referencia de pago" que el
// receptor lleva a OXXO, paga en efectivo, y Conekta notifica
// vía webhook que el pago fue completado.
//
// Para el MVP: simulamos la respuesta exitosa de Conekta.
// Cuando tengas acceso al sandbox de Conekta, reemplaza
// las funciones mock por llamadas reales a su API.
// ============================================================

export interface OxxoPaymentResult {
  success: boolean;
  reference: string;      // Referencia de pago para presentar en OXXO
  barcodeUrl: string;     // URL del código de barras (para mostrar en app)
  expiresAt: string;      // Fecha límite para pagar en OXXO
  amountMxn: number;      // Monto a pagar en pesos
}

export interface SpeiTransferResult {
  success: boolean;
  clabe: string;          // CLABE interbancaria destino
  reference: string;      // Referencia de la transferencia
  trackingId: string;     // ID de rastreo SPEI
  amountMxn: number;
}

// ─── MOCK: GENERAR PAGO EN OXXO VÍA CONEKTA ────────────────────────────────
// En producción esto llama a POST https://api.conekta.io/orders con:
//   payment_method: { type: "oxxo_cash" }
// Devuelve una referencia que el usuario presenta en la tienda OXXO.
export async function generateOxxoPayment(
  amountMxn: number,
  customerPhone: string
): Promise<OxxoPaymentResult> {
  console.log(`🏪 [MOCK] Generando pago OXXO por $${amountMxn} MXN para ${customerPhone}`);

  // Simular latencia de API real (200-500ms)
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Generar referencia de 14 dígitos (formato real de OXXO)
  const reference = Array.from({ length: 14 }, () =>
    Math.floor(Math.random() * 10)
  ).join("");

  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 horas para pagar

  return {
    success: true,
    reference,                   // ej: "93822746501284"
    barcodeUrl: `https://mock.conekta.io/barcode/${reference}`,
    expiresAt: expiresAt.toISOString(),
    amountMxn,
  };
}

// ─── MOCK: TRANSFERENCIA SPEI ───────────────────────────────────────────────
// En producción esto usa Conekta Dispersiones o Stripe Global Payouts
// para enviar dinero a la CLABE del receptor vía SPEI.
export async function generateSpeiTransfer(
  amountMxn: number,
  destinationClabe: string
): Promise<SpeiTransferResult> {
  console.log(`🏦 [MOCK] Generando transferencia SPEI por $${amountMxn} MXN a ${destinationClabe}`);

  await new Promise((resolve) => setTimeout(resolve, 300));

  const trackingId = `SPEI${Date.now()}${Math.floor(Math.random() * 1000)}`;

  return {
    success: true,
    clabe: destinationClabe,
    reference: `VAR-${trackingId.slice(-8)}`,
    trackingId,
    amountMxn,
  };
}
