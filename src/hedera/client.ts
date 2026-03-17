import { Client, AccountId, PrivateKey } from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config();

const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = process.env.HEDERA_OPERATOR_KEY;
const network = process.env.HEDERA_NETWORK || "testnet";

if (!operatorId || !operatorKey) {
  throw new Error(
    "⚠️ Faltan HEDERA_OPERATOR_ID o HEDERA_OPERATOR_KEY en el archivo .env",
  );
}

// 1. Inicializar el cliente según la red
const client =
  network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

// 2. Objetos criptográficos (¡Cambiado a ECDSA para que acepte tus llaves 0x!)
const accountId = AccountId.fromString(operatorId);
const privateKey = PrivateKey.fromStringECDSA(operatorKey);

// 3. Configurar el operador
client.setOperator(accountId, privateKey);

console.log(`✅ Cliente de Hedera inicializado en la red: ${network}`);

// 4. Validar y exportar variables adicionales de forma segura
if (!process.env.HEDERA_MXNH_TOKEN_ID) {
  throw new Error("⚠️ Falta HEDERA_MXNH_TOKEN_ID en tu archivo .env");
}
if (!process.env.HEDERA_HCS_TOPIC_ID) {
  throw new Error("⚠️ Falta HEDERA_HCS_TOPIC_ID en tu archivo .env");
}

const treasuryId = AccountId.fromString(process.env.HEDERA_TREASURY_ID!);
const treasuryKey = PrivateKey.fromStringECDSA(
  process.env.HEDERA_TREASURY_KEY!,
);
const complianceKey = PrivateKey.fromStringECDSA(
  process.env.HEDERA_COMPLIANCE_KEY!,
);
const tokenId = process.env.HEDERA_MXNH_TOKEN_ID;

export {
  client,
  accountId,
  privateKey,
  treasuryId,
  treasuryKey,
  complianceKey,
  tokenId,
};
