# @varos/mxnh-sdk

SDK para integrar el protocolo MXNH — el primer peso mexicano nativo en Hedera Hashgraph.

## Instalación
```bash
npm install @varos/mxnh-sdk
```

## Inicio rápido
```typescript
import { VarosSDK } from '@varos/mxnh-sdk';

const varos = new VarosSDK({
  apiKey: 'sk_tu_api_key',
  baseUrl: 'https://api.varos.mx',
  environment: 'testnet'
});

// Enviar $50 USD → MXNH al receptor
const result = await varos.mint({
  amountUsd: 50,
  receiverPhone: '+525512345678'
});

console.log(result.voucherCode); // "ABCD-EFGH-IJKL-MNOP"
```

## Métodos disponibles

### `mint(params)` — Convertir USD a MXNH
```typescript
const result = await varos.mint({
  amountUsd: 100,
  receiverPhone: '+525512345678'
});
// → { success, transactionId, voucherCode, amountMxnh, exchangeRate }
```

### `burn(params)` — Cobrar MXNH en pesos
```typescript
// Cobro en OXXO
const oxxo = await varos.burn({
  voucherCode: 'ABCD-EFGH-IJKL-MNOP',
  method: 'OXXO'
});

// Cobro vía SPEI
const spei = await varos.burn({
  voucherCode: 'ABCD-EFGH-IJKL-MNOP',
  method: 'SPEI',
  clabe: '012345678901234567'
});
```

### `getBalance(accountId)` — Consultar saldo
```typescript
const balance = await varos.getBalance('0.0.12345');
// → { success, accountId, balance: 4800.50 }
```

### `getRate()` — Tipo de cambio actual
```typescript
const rate = await varos.getRate();
// → { success, rate: 17.82, rateWithSpread: 17.8735, source: "chainlink" }
```

### `getReserveProof()` — Prueba de reserva on-chain
```typescript
const proof = await varos.getReserveProof();
// → { success, totalMxnh, totalMxnReserve, ratio }
```

### `transfer(params)` — Transferir MXNH entre cuentas
```typescript
const tx = await varos.transfer({
  from: '0.0.12345',
  to: '0.0.67890',
  amount: 500
});
```

### `getTransaction(txId)` — Estado de una transacción
```typescript
const tx = await varos.getTransaction('0.0.8214279@1773984482.570391141');
// → { success, status: "MINTED", amountMxnh, hcsSequence }
```

## Protocolo

- Red: Hedera Hashgraph (HTS + HCS)
- Token: MXNH (2 decimales, paridad 1:1 con MXN)
- Fee: 0.5% automático vía HTS CustomFractionalFee
- Auditoría: ISO 20022 en HCS
- Finality: < 5 segundos

## Licencia

MIT
