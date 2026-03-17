import {
  Client,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  CustomFractionalFee,
  AccountId,
  PrivateKey,
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config();

async function createMXNHToken() {
  // 1. Cargar y validar variables de entorno
  const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
  const operatorKey = PrivateKey.fromStringECDSA(
    process.env.HEDERA_OPERATOR_KEY!,
  );

  const treasuryId = AccountId.fromString(process.env.HEDERA_TREASURY_ID!);
  const treasuryKey = PrivateKey.fromStringECDSA(
    process.env.HEDERA_TREASURY_KEY!,
  );

  const complianceKey = PrivateKey.fromStringECDSA(
    process.env.HEDERA_COMPLIANCE_KEY!,
  );

  const feeCollectorId = AccountId.fromString(
    process.env.HEDERA_FEE_COLLECTOR_ID!,
  );
  const feeCollectorKey = PrivateKey.fromStringECDSA(
    process.env.HEDERA_FEE_COLLECTOR_KEY!,
  );

  // 2. Inicializar el cliente
  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);

  console.log("⏳ Configurando el token MXNH...");

  // 3. Configurar el Custom Fractional Fee (0.5% = 5 / 1000)
  const customFee = new CustomFractionalFee()
    .setNumerator(5)
    .setDenominator(1000)
    .setFeeCollectorAccountId(feeCollectorId);
  // Opcional: setMinAmount() o setMaxAmount() para poner topes a la comisión
  // Opcional: setNetOfTransfers(true) si quieres que el receptor reciba menos,
  // en vez de que el emisor pague un extra.
  // 4. Construir la transacción de creación del token
  let tokenCreateTx = await new TokenCreateTransaction()
    .setTokenName("Mexican Peso on Hedera")
    .setTokenSymbol("MXNH")
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(2)
    .setInitialSupply(0) // Empieza en 0, luego haremos 'mint'
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(treasuryId)
    // Asignación de llaves de control
    .setSupplyKey(treasuryKey)
    .setKycKey(complianceKey)
    .setFreezeKey(complianceKey)
    .setFeeScheduleKey(operatorKey) // Permite cambiar el % de fee en el futuro
    // Asignación de comisiones automáticas
    .setCustomFees([customFee])
    .freezeWith(client); // Congelamos la tx para poder firmarla con múltiples llaves

  // 5. Firmar la transacción
  // REGLA DE HEDERA: La cuenta de tesorería DEBE firmar para aceptar ser tesorería.
  // El operador firma automáticamente porque se seteó en el client.
  let signTx = await tokenCreateTx.sign(treasuryKey);
  // El recaudador de comisiones también DEBE firmar
  signTx = await signTx.sign(feeCollectorKey);

  // 6. Ejecutar la transacción en la red
  console.log("🚀 Enviando transacción a Hedera Testnet...");
  let txResponse = await signTx.execute(client);

  // 7. Obtener el recibo y extraer el ID del Token
  let receipt = await txResponse.getReceipt(client);
  let tokenId = receipt.tokenId;

  console.log(`\n🎉 ¡ÉXITO! MXNH ha sido creado.`);
  console.log(`🪙  Token ID: ${tokenId}`);
  console.log(
    `🔍 Verifica en Hashscan: https://hashscan.io/testnet/token/${tokenId}`,
  );

  process.exit(0);
}

createMXNHToken().catch((err) => {
  console.error("❌ Error creando el token:", err);
  process.exit(1);
});
