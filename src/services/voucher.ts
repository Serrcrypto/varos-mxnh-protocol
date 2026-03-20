// ============================================================
// src/services/voucher.ts
// Servicio de vouchers para cobro en OXXO y SPEI.
// Genera códigos únicos, los almacena, y gestiona su ciclo de vida:
// ACTIVE → REDEEMED (cobrado) o EXPIRED (expirado)
// ============================================================

// ─── ALMACENAMIENTO EN MEMORIA ──────────────────────────────────────────────
// Para el MVP usamos un Map en memoria. En producción esto se reemplaza
// por la tabla "vouchers" en Prisma/Neon.
// NOTA: Los datos se pierden si reinicias el servidor.

export interface Voucher {
  code: string;            // Código único formato ABCD-EFGH-IJKL-MNOP
  amountMxnh: number;      // Monto en MXNH asociado al voucher
  receiverPhone: string;   // Teléfono del receptor
  status: "ACTIVE" | "REDEEMED" | "EXPIRED";
  transactionId: string;   // ID de la transacción de mint en Hedera
  hcsSequence: string;     // Secuencia del mensaje HCS del mint
  createdAt: Date;
  expiresAt: Date;         // 7 días después de creación
  redeemedAt?: Date;       // Fecha de cobro (si aplica)
  offRampType?: "OXXO" | "SPEI"; // Método de cobro usado
  oxxoReference?: string;  // Referencia de OXXO/Conekta (si aplica)
}

// Map en memoria: código → voucher
const voucherStore = new Map<string, Voucher>();

// ─── GENERAR CÓDIGO ÚNICO ───────────────────────────────────────────────────
// Formato: ABCD-EFGH-IJKL-MNOP (16 caracteres alfanuméricos en 4 bloques)
// Usa solo letras mayúsculas y números para que sea fácil de dictar por teléfono
function generateVoucherCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sin I/O/0/1 para evitar confusión
  let code = "";

  for (let i = 0; i < 16; i++) {
    // Cada 4 caracteres agregar un guión (excepto al final)
    if (i > 0 && i % 4 === 0) code += "-";
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

// ─── CREAR VOUCHER ──────────────────────────────────────────────────────────
// Se llama después de un minteo exitoso para generar el código de cobro.
export function createVoucher(
  amountMxnh: number,
  receiverPhone: string,
  transactionId: string,
  hcsSequence: string
): Voucher {
  // Generar código único (reintentar si ya existe, aunque es casi imposible)
  let code = generateVoucherCode();
  while (voucherStore.has(code)) {
    code = generateVoucherCode();
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 días

  const voucher: Voucher = {
    code,
    amountMxnh,
    receiverPhone,
    status: "ACTIVE",
    transactionId,
    hcsSequence,
    createdAt: now,
    expiresAt,
  };

  voucherStore.set(code, voucher);
  console.log(`🎫 Voucher creado: ${code} por ${amountMxnh} MXNH`);

  return voucher;
}

// ─── BUSCAR VOUCHER ─────────────────────────────────────────────────────────
// Busca por código y verifica si ha expirado (actualiza status automáticamente)
export function getVoucher(code: string): Voucher | null {
  const voucher = voucherStore.get(code.toUpperCase());

  if (!voucher) return null;

  // Si está ACTIVE pero ya pasó la fecha de expiración, marcarlo como EXPIRED
  if (voucher.status === "ACTIVE" && new Date() > voucher.expiresAt) {
    voucher.status = "EXPIRED";
  }

  return voucher;
}

// ─── MARCAR COMO COBRADO ────────────────────────────────────────────────────
// Se llama cuando el receptor cobra en OXXO o SPEI
export function redeemVoucher(
  code: string,
  offRampType: "OXXO" | "SPEI",
  oxxoReference?: string
): Voucher | null {
  const voucher = getVoucher(code);

  if (!voucher) return null;
  if (voucher.status !== "ACTIVE") return null; // Solo se puede cobrar si está activo

  voucher.status = "REDEEMED";
  voucher.redeemedAt = new Date();
  voucher.offRampType = offRampType;
  voucher.oxxoReference = oxxoReference;

  console.log(`✅ Voucher ${code} cobrado vía ${offRampType}`);

  return voucher;
}
