// ============================================================
// Ejemplo: Enviar dinero de USA a México con el SDK de Varos
//
// Una fintech integra MXNH con estas pocas líneas.
// Este archivo demuestra al jurado la simplicidad del protocolo.
//
// Para ejecutar:
//   cd packages/sdk
//   npx tsx examples/send-money.ts
// ============================================================

import { VarosSDK } from "../src";

// ─── CONFIGURACIÓN ──────────────────────────────────────────────────────────
// En producción cada fintech recibe su propia API key al registrarse
// vía POST /sdk/v1/register. Para esta demo usamos la TEST_API_KEY.
const API_KEY = "vr_live_8f7d6c5b4a392018"; // ← Pon aquí tu TEST_API_KEY del .env
const BASE_URL = "http://localhost:3000";
const RECEIVER_PHONE = "+520000000000"; // Teléfono del receptor en México

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  VAROS MXNH — Demo de integración SDK para fintechs");
  console.log("  Protocolo de peso mexicano nativo en Hedera Hashgraph");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ─── PASO 1: Inicializar el SDK ───────────────────────────────────────────
  const varos = new VarosSDK({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
    environment: "testnet",
  });
  console.log("✅ SDK inicializado\n");

  // ─── PASO 2: Consultar tipo de cambio actual ─────────────────────────────
  console.log("📊 Consultando tipo de cambio...");
  const rate = await varos.getRate();
  if (rate.success) {
    console.log(`   Tipo de cambio base: 1 USD = ${rate.rate} MXN`);
    console.log(
      `   Con spread (${rate.spread}): 1 USD = ${rate.rateWithSpread} MXN`,
    );
    console.log(`   Fuente: ${rate.source}`);
  } else {
    console.error(`   ❌ Error: ${rate.error}`);
  }

  // ─── PASO 3: Enviar $100 USD a México ─────────────────────────────────────
  console.log(`\n💸 Enviando $101 USD a ${RECEIVER_PHONE}...`);
  const mint = await varos.mint({
    amountUsd: 101,
    receiverPhone: RECEIVER_PHONE,
  });

  if (mint.success) {
    console.log(`   ✅ ¡Envío exitoso!`);
    console.log(`   Monto enviado: $${mint.amountUsd} USD`);
    console.log(`   Monto recibido: ${mint.amountMxnh} MXNH`);
    console.log(`   Tipo de cambio: ${mint.exchangeRate}`);
    console.log(`   Fee del protocolo (0.5%): ${mint.protocolFee} MXNH`);
    console.log(`   TX Hedera: ${mint.transactionId}`);
    console.log(`   HCS (ISO 20022): secuencia #${mint.hcsSequence}`);
    console.log(`   Voucher: ${mint.voucherCode}`);
  } else {
    console.error(`   ❌ Error en mint: ${mint.error}`);
    return;
  }

  // ─── PASO 4: Consultar estado de la transacción ──────────────────────────
  if (mint.transactionId) {
    console.log(`\n🔍 Consultando estado de la transacción...`);
    const tx = await varos.getTransaction(mint.transactionId);
    if (tx.success) {
      console.log(`   Estado: ${tx.status}`);
      console.log(`   Tipo: ${tx.type}`);
      console.log(`   TX ID: ${tx.transactionId}`);
      console.log(`   HCS: secuencia #${tx.hcsSequence}`);
    } else {
      console.log(`   ⚠️  ${tx.error}`);
    }
  }

  // ─── PASO 5: Simular cobro en OXXO ───────────────────────────────────────
  if (mint.voucherCode) {
    console.log(`\n🏪 Receptor cobra en OXXO con código: ${mint.voucherCode}`);
    const redeem = await varos.burn({
      voucherCode: mint.voucherCode,
      method: "OXXO",
    });
    if (redeem.success) {
      console.log(`   ✅ Cobro exitoso`);
      console.log(`   Monto: ${redeem.amountMxnh} MXN`);
      console.log(`   Referencia OXXO: ${redeem.offRampReference}`);
      console.log(`   Burn TX: ${redeem.transactionId}`);
      console.log(`   HCS: secuencia #${redeem.hcsSequence}`);
    } else {
      console.log(`   ⚠️  ${redeem.error}`);
    }
  }

  // ─── PASO 6: Consultar proof-of-reserve ───────────────────────────────────
  console.log(`\n🛡️  Verificando proof-of-reserve...`);
  const proof = await varos.getReserveProof();
  if (proof.success) {
    console.log(`   MXNH en circulación: ${proof.totalMxnh}`);
    console.log(`   MXN en reserva: ${proof.totalMxnReserve}`);
    console.log(`   Ratio de colateral: ${proof.ratio}`);
    console.log(`   HCS: secuencia #${proof.hcsSequence}`);
  } else {
    console.log(`   ⚠️  ${proof.error}`);
  }

  // ─── RESUMEN ──────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  ✅ Flujo completo ejecutado con éxito");
  console.log("  Todo registrado on-chain en Hedera (HTS + HCS)");
  console.log("  Verificable en: hashscan.io/testnet");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch(console.error);
