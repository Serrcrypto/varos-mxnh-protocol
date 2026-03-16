import { Client, AccountId, PrivateKey } from '@hashgraph/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = process.env.HEDERA_OPERATOR_KEY;
const network = process.env.HEDERA_NETWORK || 'testnet';

if (!operatorId || !operatorKey) {
  throw new Error('⚠️ Faltan HEDERA_OPERATOR_ID o HEDERA_OPERATOR_KEY en el archivo .env');
}

// 1. Inicializar el cliente según la red especificada (usaremos testnet por ahora)
const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

// 2. Convertir los strings del .env a los objetos criptográficos que requiere el SDK
const accountId = AccountId.fromString(operatorId);
const privateKey = PrivateKey.fromStringDer(operatorKey);

// 3. Configurar el operador (quien firma y paga por las transacciones)
client.setOperator(accountId, privateKey);

console.log(`✅ Cliente de Hedera inicializado en la red: ${network}`);

export { client, accountId, privateKey };
