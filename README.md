# Varos — MXNH Protocol

> **"Stripe paid $1.1B for Bridge (stablecoin protocol). MXNH is Bridge for the Mexican peso on Hedera."**

**Varos** is a B2B infrastructure protocol that issues and settles **MXNH** — the first native Mexican peso on Hedera Hashgraph. Fintechs integrate MXNH via SDK to operate the US→Mexico corridor ($64B annual flow) with on-chain settlement, automatic 0.5% fee collection, and ISO 20022 audit trail — all in under 5 seconds.

[![Hedera Testnet](https://img.shields.io/badge/Hedera-Testnet-6B46C1?logo=hedera)](https://hashscan.io/testnet/token/0.0.8252633)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Hackathon](https://img.shields.io/badge/Hedera%20Apex-2026-orange)](https://hedera.com/blog/hedera-apex-hackathon)

---

## Live Demo

| | Link |
|---|---|
| **Public Dashboard** | https://varos-mxnh-protocol.vercel.app/dashboard |
| **API Health** | https://varos-mxnh-protocol-production.up.railway.app/health |
| **MXNH Token on HashScan** | https://hashscan.io/testnet/token/0.0.8252633 |
| **Fee Collector on HashScan** | https://hashscan.io/testnet/account/0.0.8252168 |

---

## The Problem

The US→Mexico remittance corridor moves **$64 billion per year**. Today:

- Settlement takes **2–5 business days** via SWIFT/ACH
- Fees range from **3–7%** per transaction
- No programmable money — no automated compliance, no on-chain proof
- Fintechs must build custom payment rails from scratch every time

## The Solution

MXNH is a **programmable peso** on Hedera. One SDK call replaces months of banking integrations:

```typescript
const varos = new VarosSDK({ apiKey: 'vr_live_...', baseUrl: 'https://api.varos.mx' });
const result = await varos.mint({ amountUsd: 100, receiverPhone: '+525512345678' });
// Done. USD received, MXNH minted, 0.5% fee collected on-chain, ISO 20022 logged, SMS sent.
```

---

## Protocol Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                       VAROS MXNH PROTOCOL                         │
├───────────────────────────────────────────────────────────────────┤
│                                                                     │
│  FINTECH / APP           VAROS BACKEND           HEDERA NETWORK    │
│                                                                     │
│  ┌──────────┐           ┌─────────────┐        ┌──────────────┐  │
│  │ VarosSDK │──REST────▶│  FX Oracle  │        │  HTS Token   │  │
│  │          │           │  Chainlink  │        │  MXNH        │  │
│  │  mint()  │           │  + fallback │        │  0.0.8252633 │  │
│  │  burn()  │           └──────┬──────┘        └──────┬───────┘  │
│  │  transfer│                  │                      │           │
│  └──────────┘           ┌──────▼──────┐        ┌──────▼───────┐  │
│                         │ Orchestrator│        │  HCS Audit   │  │
│  ┌──────────┐           │ varos.ts    │        │  ISO 20022   │  │
│  │  Stripe  │──webhook─▶│             │        │  Topic       │  │
│  │  Connect │           │ processPaym │        └──────────────┘  │
│  │  USD in  │           │ ent()       │                           │
│  └──────────┘           └──────┬──────┘                           │
│                                │                                   │
│  ┌──────────┐           ┌──────▼──────┐   Fee Collector           │
│  │  Twilio  │◀──────────│  Voucher    │   0.0.8252168             │
│  │  SMS     │           │  Service    │   ← 0.5% auto (HTS)      │
│  │  +52...  │           └──────┬──────┘                           │
│  └──────────┘                  │                                   │
│                         ┌──────▼──────┐                           │
│  ┌──────────┐           │  Off-ramp   │                           │
│  │OXXO/SPEI │◀──────────│  burn()     │                           │
│  └──────────┘           └─────────────┘                           │
└───────────────────────────────────────────────────────────────────┘
```

### Transaction Flow

```
1. Sender pays USD via Stripe Connect
2. Backend queries FX oracle → mints equivalent MXNH (HTS)
3. HTS automatically collects 0.5% → Fee Collector (0.0.8252168)
4. ISO 20022 message logged to HCS for permanent audit trail
5. Twilio sends SMS to receiver with voucher code
6. Receiver redeems at OXXO or via SPEI bank transfer
7. MXNH burned on redemption → proof-of-reserve updated on-chain
```

---

## Technical Stack

| Layer | Technology |
|---|---|
| Token | Hedera HTS — MXNH (0.0.8252633), 2 decimals, infinite supply |
| Fee | `CustomFractionalFee` 0.5% → Fee Collector (automatic in HTS) |
| Consensus / Audit | Hedera Consensus Service (HCS) with ISO 20022 messages |
| On-ramp USD | Stripe Connect (platform model — fintechs as connected accounts) |
| FX Oracle | Chainlink MXNUSD feed → exchangerate-api fallback → 5min cache |
| Off-ramp | OXXO via Conekta + SPEI (mock in MVP, real APIs in production) |
| Notifications | Twilio SMS |
| Backend | Node.js + TypeScript + Fastify (deployed on Railway) |
| Database | Prisma ORM + Neon PostgreSQL Serverless |
| SDK | `@varos/mxnh-sdk` TypeScript — open source |
| Frontend | React + Vite + TailwindCSS + HashConnect + Stripe Elements (Vercel) |

---

## MXNH Token Properties

| Property | Value |
|---|---|
| Token ID | `0.0.8252633` on Hedera Testnet |
| Parity | 1 MXNH = 1 MXN (1:1 collateralized) |
| Decimals | 2 |
| Supply | INFINITE (mint/burn by Treasury) |
| Protocol Fee | 0.5% `CustomFractionalFee` → `0.0.8252168` |
| KYC / AML | Native HTS flags (Compliance account) |
| Finality | < 5 seconds, deterministic |
| Cost per tx | < $0.01 USD |

**4 Hedera Accounts (required by design):**

| Account | Role |
|---|---|
| Operator | Pays HBAR fees for all transactions |
| Treasury (`0.0.8252102`) | Mints and burns MXNH |
| Compliance (`0.0.8252126`) | Manages KYC/AML flags |
| Fee Collector (`0.0.8252168`) | Receives automatic 0.5% on every transfer |

---

## SDK Reference

```bash
npm install @varos/mxnh-sdk   # coming to NPM — currently via npm link
```

```typescript
import { VarosSDK } from '@varos/mxnh-sdk';

const varos = new VarosSDK({
  apiKey: 'vr_live_...',
  baseUrl: 'https://varos-mxnh-protocol-production.up.railway.app',
  environment: 'testnet',
});
```

### Available Methods

| Method | Description |
|---|---|
| `varos.mint({ amountUsd, receiverPhone })` | Convert USD → MXNH, send voucher via SMS |
| `varos.burn({ voucherCode, method })` | Redeem MXNH at OXXO or SPEI |
| `varos.transfer({ from, to, amount })` | Transfer MXNH between Hedera accounts |
| `varos.getBalance(accountId)` | Get MXNH balance for any account |
| `varos.getRate()` | Current MXN/USD exchange rate with spread |
| `varos.getReserveProof()` | On-chain proof-of-reserve via HCS |
| `varos.getTransaction(txId)` | Transaction status + ISO 20022 HCS metadata |

### REST API Endpoints

```
POST   /sdk/v1/register      Register new fintech (x-admin-key required)
POST   /sdk/v1/mint          Mint MXNH (x-api-key required)
POST   /sdk/v1/burn          Burn MXNH for off-ramp (x-api-key required)
POST   /sdk/v1/transfer      Transfer MXNH between accounts
GET    /sdk/v1/balance/:id   MXNH balance for Hedera account ID
GET    /sdk/v1/rate          Current MXN/USD FX rate
GET    /sdk/v1/tx/:id        Transaction state + HCS sequence
GET    /fx/rate              Public FX rate (no auth)
GET    /health               Service health check
```

---

## Integration Example

Full end-to-end remittance — $100 USD to Mexico in ~30 lines:

```typescript
// packages/sdk/examples/send-money.ts
import { VarosSDK } from '@varos/mxnh-sdk';

const varos = new VarosSDK({
  apiKey: process.env.VAROS_API_KEY!,
  baseUrl: 'https://varos-mxnh-protocol-production.up.railway.app',
  environment: 'testnet',
});

// 1. Check exchange rate
const rate = await varos.getRate();
console.log(`1 USD = ${rate.rateWithSpread} MXNH (incl. 0.3% spread)`);

// 2. Send $100 USD → Mexico (mint + SMS + HCS log, all in one call)
const tx = await varos.mint({
  amountUsd: 100,
  receiverPhone: '+525512345678',
});
// tx.amountMxnh   → ~1,700 MXNH (at current rate)
// tx.protocolFee  → ~8.5 MXNH (0.5% collected automatically by HTS)
// tx.voucherCode  → "ABCD-EFGH-IJKL-MNOP" (sent via SMS)
// tx.hcsSequence  → ISO 20022 sequence # on Hedera

// 3. Receiver redeems at OXXO
const redeem = await varos.burn({
  voucherCode: tx.voucherCode!,
  method: 'OXXO',
});

// 4. Verify on-chain proof-of-reserve
const proof = await varos.getReserveProof();
console.log(`Collateral ratio: ${proof.ratio} — ${proof.totalMxnh} MXNH / ${proof.totalMxnReserve} MXN`);
```

Run it:
```bash
cd packages/sdk
npx tsx examples/send-money.ts
```

---

## HCS — ISO 20022 Message Format

Every transaction is permanently recorded on Hedera Consensus Service:

```json
{
  "MsgId":    "550e8400-e29b-41d4-a716-446655440000",
  "CreDtTm":  "2026-03-21T18:30:00.000Z",
  "MsgType":  "MINT",
  "InstdAmt": { "value": 1700.00, "currency": "MXN" },
  "DbtrAcct": "0.0.8214279",
  "CdtrAcct": "0.0.8252102",
  "TxRef":    "0.0.8252633@1711045800",
  "PrtclFee": { "value": 8.50, "collector": "0.0.8252168" }
}
```

Message types: `MINT | BURN | TRANSFER | RESERVE_PROOF`

---

## Run Locally

**Prerequisites:** Node.js >= 20, Hedera testnet accounts, Neon database, Stripe test account.

```bash
git clone https://github.com/YOUR_USER/varos-mxnh-protocol.git
cd varos-mxnh-protocol

# Backend
npm install
cp .env.example .env         # fill in your keys
npx prisma generate
npm run dev                  # → http://localhost:3000

# Frontend (new terminal)
cd apps/web
npm install
cp .env.example .env         # set VITE_API_URL=http://localhost:3000
npm run dev                  # → http://localhost:5173

# SDK example (new terminal)
cd packages/sdk
npm install && npm run build && npm link
npx tsx examples/send-money.ts
```

Verify backend:
```bash
curl http://localhost:3000/health
# {"status":"ok","message":"🚀 Varos MXNH Protocol API running"}
```

See [DEPLOY.md](DEPLOY.md) for full Railway + Vercel deployment guide.

---

## Business Model

| Revenue Source | Details |
|---|---|
| Protocol fee (on-chain, automatic) | 0.5% of every MXNH transfer via HTS `CustomFractionalFee` |
| SDK licensing (enterprise) | $2K–$10K/month per fintech integration |
| Float yield on MXN collateral | ~10% APY (CETES — Mexican government bonds) |
| Hedera Foundation grant | Up to $250K |

**Target customer:** Kira Financial AI ($8.7M raised, operates US→MX with OXXO) — one Varos SDK integration replaces their entire custom payment rail.

**TAM:** $64B/year US→Mexico remittances. 0.5% fee on 1% market share = **$3.2M ARR**.

---

## MVP Limitations

This MVP demonstrates full technical feasibility. The following are known constraints for the hackathon submission:

**1. Fee Collector balance shows $0 on HashScan**
The 0.5% `CustomFractionalFee` is correctly configured on the MXNH token (verifiable on HashScan). This fee triggers automatically on `TransferTransaction` between Hedera accounts. The MVP calls `mintMXNH()` directly (Treasury mints to itself). In production, all flows use `TransferTransaction`, ensuring automatic fee collection on every movement.

**2. In-memory stores**
SDK transactions, registered clients, and vouchers are in-process Maps (reset on restart). The Prisma schema (`prisma/schema.prisma`) already defines the full PostgreSQL model (`transactions`, `sdk_clients`, `vouchers`, `users`, `reserve_proofs`). Wiring to Neon is a one-session task.

**3. CORS `origin: true` in development**
Dev server accepts all origins. Production restricts to `CORS_ORIGIN` env var (the Vercel domain).

**4. Stripe Direct (no Connect sub-account)**
The reference app does not pass `connectedAccountId`. The code in `src/payments/stripe.ts` is fully Stripe Connect-ready — production fintechs each get their own connected account for revenue routing.

**5. Off-ramp mocks**
OXXO (Conekta) and SPEI (STP) are simulated. Integration points and data contracts are correct; real API calls are a drop-in replacement.

**6. Twilio trial account**
5 SMS/day limit, verified numbers only. Production uses a full account.

**7. SDK not yet on NPM**
Works via `npm link` locally. `npm publish` is the only remaining step.

**8. Dashboard "Recent Transactions" is a placeholder**
Requires a transaction history endpoint or Hedera Mirror Node query integration.

**9. Proof-of-reserve on-demand**
`GET /hedera/reserve` publishes a new HCS message each call (costs HBAR). The dashboard exposes a manual refresh button. Production: scheduled proof every N minutes via a cron job.

---

## Project Structure

```
varos-mxnh-protocol/
├── src/
│   ├── index.ts              # Fastify server + CORS
│   ├── hedera/               # HTS token + HCS audit + reserve proof
│   ├── payments/             # Stripe Connect + Conekta (OXXO/SPEI)
│   ├── notifications/        # Twilio SMS
│   ├── fx/                   # FX oracle (Chainlink + fallback)
│   ├── services/             # Orchestrator + voucher logic
│   └── routes/               # /hedera, /sdk/v1, /payments, /voucher, /fx
├── packages/
│   └── sdk/                  # @varos/mxnh-sdk — open source TypeScript SDK
│       ├── src/index.ts      # VarosSDK class (7 methods)
│       └── examples/send-money.ts
├── apps/
│   └── web/                  # React + Vite + TailwindCSS + HashConnect
│       └── src/
│           ├── pages/        # Home, Send, Pay, Success, Dashboard
│           ├── hooks/        # useHashConnect, useExchangeRate, useDashboardData
│           └── lib/api.ts    # HTTP client with x-api-key auth
├── prisma/schema.prisma      # 5 tables: users, transactions, vouchers, sdk_clients, reserve_proofs
├── .env.example              # Backend environment variables template
├── apps/web/.env.example     # Frontend environment variables template
├── railway.json              # Railway deployment config
├── nixpacks.toml             # Railway build config
├── DEPLOY.md                 # Full Railway + Vercel deployment guide
└── CLAUDE.md                 # Protocol rules and architecture context
```

---

## Hackathon

**Hedera Apex 2026** — DeFi & Tokenization Track
Deadline: March 23, 2026

---

## License

MIT — see [LICENSE](LICENSE)

---

*MXNH on HashScan: [hashscan.io/testnet/token/0.0.8252633](https://hashscan.io/testnet/token/0.0.8252633)*
