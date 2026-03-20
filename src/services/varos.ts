// ============================================================
// src/services/varos.ts
// ORQUESTADOR PRINCIPAL del protocolo Varos.
//
// Este archivo coordina el flujo completo de una transacción:
// USD entra → MXNH se mintea → voucher se crea → SMS se envía
//
// Es el "cerebro" del protocolo. Cada paso está en su propio
// módulo, pero varos.ts los conecta en el orden correcto y
// maneja errores si algún paso falla.
// ============================================================

import { mintMXNH } from "../hedera/token";
import { logTransaction } from "../hedera/hcs";
import { createVoucher, Voucher } from "../services/voucher";
import { sendPaymentNotification } from "../notifications/twilio";

// ─── TIPOS ──────────────────────────────────────────────────────────────────

// Datos que llegan del webhook de Stripe cuando un pago es exitoso
export interface PaymentData {
  amountUsd: number;         // Monto pagado en dólares
  receiverPhone: string;     // Teléfono del receptor en México
  sdkClientId?: string;      // ID de la fintech que originó la tx (opcional)
  stripePaymentIntentId: string; // ID del PaymentIntent de Stripe
}

// Resultado completo de procesar una transacción
export interface TransactionResult {
  success: boolean;
  status: "MINTED" | "FAILED";
  error?: string;
  failedStep?: string;       // En qué paso falló (para debugging)
  data?: {
    amountUsd: number;
    amountMxnh: number;
    exchangeRate: number;
    protocolFee: number;
    transactionId: string;   // TX de Hedera
    hcsSequence: string;     // Secuencia en HCS
    voucher: {
      code: string;
      expiresAt: Date;
    };
    smsDelivered: boolean;   // Si el SMS se envió (puede fallar sin romper el flujo)
  };
}

// ─── ALMACÉN DE TRANSACCIONES EN MEMORIA ────────────────────────────────────
// Reemplazar por tabla "transactions" en Prisma/Neon para producción.
// Almacena cada transacción con su estado y metadata.

interface TransactionRecord {
  id: string;
  amountUsd: number;
  amountMxnh: number;
  exchangeRate: number;
  protocolFee: number;
  status: "PENDING" | "MINTED" | "DELIVERED" | "FAILED";
  hederaTxId?: string;
  hcsMessageId?: string;
  voucherCode?: string;
  receiverPhone: string;
  sdkClientId?: string;
  stripePaymentIntentId: string;
  offRampType?: "OXXO" | "SPEI";
  isoMessageId?: string;
  failedStep?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const transactionStore = new Map<string, TransactionRecord>();

// ─── FLUJO PRINCIPAL ────────────────────────────────────────────────────────
// Orquesta todo el proceso cuando llega un pago exitoso de Stripe.
// Cada paso tiene try/catch individual para saber exactamente dónde falla.

export async function processPayment(payment: PaymentData): Promise<TransactionResult> {
  const txRecord: TransactionRecord = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    amountUsd: payment.amountUsd,
    amountMxnh: 0,
    exchangeRate: 0,
    protocolFee: 0,
    status: "PENDING",
    receiverPhone: payment.receiverPhone,
    sdkClientId: payment.sdkClientId,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Guardar registro inicial como PENDING
  transactionStore.set(txRecord.id, txRecord);

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 1: Calcular monto en MXNH usando tipo de cambio
    // ═══════════════════════════════════════════════════════════════════════
    // Por ahora tipo de cambio fijo. En Etapa 4 se conecta al oracle Chainlink.
    const exchangeRate = 17.5; // MXN por USD
    const amountMxnh = parseFloat((payment.amountUsd * exchangeRate).toFixed(2));
    const protocolFee = parseFloat((amountMxnh * 0.005).toFixed(2)); // 0.5%

    txRecord.amountMxnh = amountMxnh;
    txRecord.exchangeRate = exchangeRate;
    txRecord.protocolFee = protocolFee;

    console.log(`\n══════════════════════════════════════════`);
    console.log(`📋 NUEVA TRANSACCIÓN: ${txRecord.id}`);
    console.log(`💵 $${payment.amountUsd} USD × ${exchangeRate} = ${amountMxnh} MXNH`);
    console.log(`💰 Fee protocolo: ${protocolFee} MXNH (0.5%)`);
    console.log(`══════════════════════════════════════════\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // PASO 2: Mintear MXNH en Hedera (fee 0.5% se cobra automático por HTS)
    // ═══════════════════════════════════════════════════════════════════════
    let transactionId: string;
    try {
      transactionId = await mintMXNH(amountMxnh);
      txRecord.hederaTxId = transactionId;
      console.log(`✅ Paso 2: MXNH minteado → ${transactionId}`);
    } catch (error: any) {
      return failTransaction(txRecord, "MINT", error.message);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PASO 3: Registrar en HCS con estructura ISO 20022
    // ═══════════════════════════════════════════════════════════════════════
    let hcsSequence: string;
    try {
      hcsSequence = await logTransaction({
        MsgType: "MINT",
        InstdAmt: { value: amountMxnh, currency: "MXN" },
        DbtrAcct: process.env.HEDERA_TREASURY_ID || null,
        CdtrAcct: process.env.HEDERA_TREASURY_ID || null,
        TxRef: transactionId,
        PrtclFee: {
          value: protocolFee,
          collector: process.env.HEDERA_FEE_COLLECTOR_ID!,
        },
      });
      txRecord.hcsMessageId = hcsSequence;
      console.log(`✅ Paso 3: HCS registrado → Seq: ${hcsSequence}`);
    } catch (error: any) {
      return failTransaction(txRecord, "HCS_LOG", error.message);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PASO 4: Crear voucher para cobro en OXXO o SPEI
    // ═══════════════════════════════════════════════════════════════════════
    let voucher: Voucher;
    try {
      voucher = createVoucher(
        amountMxnh,
        payment.receiverPhone,
        transactionId,
        hcsSequence
      );
      txRecord.voucherCode = voucher.code;
      console.log(`✅ Paso 4: Voucher creado → ${voucher.code}`);
    } catch (error: any) {
      return failTransaction(txRecord, "VOUCHER", error.message);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PASO 5: Enviar SMS al receptor con Twilio
    // ═══════════════════════════════════════════════════════════════════════
    // Este paso NO es crítico. Si el SMS falla (límite trial, número malo),
    // la transacción sigue siendo exitosa. El voucher existe y puede
    // consultarse vía la API.
    let smsDelivered = false;
    try {
      const smsResult = await sendPaymentNotification(
        payment.receiverPhone,
        amountMxnh,
        voucher.code
      );
      smsDelivered = smsResult.success;
      console.log(`${smsDelivered ? "✅" : "⚠️"} Paso 5: SMS ${smsDelivered ? "enviado" : "no enviado (no crítico)"}`);
    } catch (error: any) {
      console.warn(`⚠️ Paso 5: SMS falló (no crítico): ${error.message}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PASO 6: Marcar transacción como exitosa
    // ═══════════════════════════════════════════════════════════════════════
    txRecord.status = "MINTED";
    txRecord.updatedAt = new Date();

    console.log(`\n🎉 TRANSACCIÓN COMPLETADA: ${txRecord.id}`);
    console.log(`   Voucher: ${voucher.code}`);
    console.log(`   Hedera TX: ${transactionId}`);
    console.log(`   HCS Seq: ${hcsSequence}\n`);

    return {
      success: true,
      status: "MINTED",
      data: {
        amountUsd: payment.amountUsd,
        amountMxnh,
        exchangeRate,
        protocolFee,
        transactionId,
        hcsSequence,
        voucher: {
          code: voucher.code,
          expiresAt: voucher.expiresAt,
        },
        smsDelivered,
      },
    };
  } catch (error: any) {
    // Error inesperado no capturado en ningún paso
    return failTransaction(txRecord, "UNKNOWN", error.message);
  }
}

// ─── HELPER: MARCAR TRANSACCIÓN COMO FALLIDA ────────────────────────────────
// Registra en qué paso falló y el mensaje de error.
function failTransaction(
  txRecord: TransactionRecord,
  step: string,
  errorMessage: string
): TransactionResult {
  txRecord.status = "FAILED";
  txRecord.failedStep = step;
  txRecord.errorMessage = errorMessage;
  txRecord.updatedAt = new Date();

  console.error(`❌ TRANSACCIÓN FALLIDA en paso ${step}: ${errorMessage}`);
  console.error(`   TX ID: ${txRecord.id}`);

  return {
    success: false,
    status: "FAILED",
    error: errorMessage,
    failedStep: step,
  };
}

// ─── CONSULTAR TRANSACCIÓN ──────────────────────────────────────────────────
// Para debugging y para el dashboard.
export function getTransaction(id: string): TransactionRecord | undefined {
  return transactionStore.get(id);
}

export function getAllTransactions(): TransactionRecord[] {
  return Array.from(transactionStore.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}
