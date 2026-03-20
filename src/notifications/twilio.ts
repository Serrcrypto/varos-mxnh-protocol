// ============================================================
// src/notifications/twilio.ts
// Módulo de notificaciones SMS vía Twilio.
// Envía al receptor mexicano un SMS con el monto disponible
// y su código de voucher para cobrar en OXXO o vía SPEI.
// ============================================================

import Twilio from "twilio";

// Inicializar cliente de Twilio con credenciales del .env
const client = Twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
);

// Número desde el que Twilio envía los SMS (comprado en Twilio)
const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

// ─── NORMALIZAR NÚMERO MEXICANO ────────────────────────────────────────────
// Acepta varios formatos y los convierte a formato internacional +52XXXXXXXXXX
//
// Formatos que maneja:
//   "5512345678"        → "+525512345678"   (10 dígitos, local)
//   "525512345678"      → "+525512345678"   (12 dígitos, con código país)
//   "+525512345678"     → "+525512345678"   (ya internacional)
//   "52 55 1234 5678"   → "+525512345678"   (con espacios)
//   "044 55 1234 5678"  → "+525512345678"   (prefijo celular viejo)
function normalizePhoneNumber(phone: string): string {
  // 1. Quitar espacios, guiones y paréntesis
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");

  // 2. Quitar prefijo celular viejo de México (044 o 045)
  if (cleaned.startsWith("044") || cleaned.startsWith("045")) {
    cleaned = cleaned.substring(3);
  }

  // 3. Si ya tiene +52, está listo
  if (cleaned.startsWith("+52")) {
    return cleaned;
  }

  // 4. Si empieza con 52 y tiene 12 dígitos, agregar +
  if (cleaned.startsWith("52") && cleaned.length === 12) {
    return `+${cleaned}`;
  }

  // 5. Si son 10 dígitos (número local), agregar +52
  if (cleaned.length === 10) {
    return `+52${cleaned}`;
  }

  // 6. Si nada aplica, devolver con + por si es otro país
  if (!cleaned.startsWith("+")) {
    return `+${cleaned}`;
  }

  return cleaned;
}

// ─── ENVIAR NOTIFICACIÓN DE PAGO ────────────────────────────────────────────
// Envía SMS al receptor con el monto y código de voucher.
// Retorna el SID del mensaje de Twilio (identificador único).
export async function sendPaymentNotification(
  phoneNumber: string,
  amountMxn: number,
  voucherCode: string,
): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  try {
    const to = normalizePhoneNumber(phoneNumber);

    // Formato del monto: 4,800.50 → "$4,800.50 MXN"
    const formattedAmount = amountMxn.toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const messageBody =
      `Varos: Tienes $${formattedAmount} MXN disponibles. ` +
      `Tu codigo de cobro: ${voucherCode}. ` +
      `Cobra en OXXO o transfiere a tu banco.`;

    console.log(`📱 Enviando SMS a ${to}: ${messageBody}`);

    const message = await client.messages.create({
      body: messageBody,
      from: fromNumber,
      to,
    });

    console.log(`✅ SMS enviado [SID: ${message.sid}] a ${to}`);

    return { success: true, messageSid: message.sid };
  } catch (error: any) {
    console.error("❌ Error enviando SMS:", error.message);
    return { success: false, error: error.message };
  }
}
