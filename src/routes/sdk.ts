// ============================================================
// src/routes/sdk.ts
// Endpoints públicos del protocolo para clientes SDK.
// Estos son los endpoints que @varos/mxnh-sdk consume.
//
// Autenticación: cada fintech recibe un API key al registrarse.
// El SDK envía ese key en el header x-api-key.
// ============================================================

import { FastifyInstance } from "fastify";
import { mintMXNH, burnMXNH, getBalance } from "../hedera/token";
import { logTransaction } from "../hedera/hcs";
import { getAllTransactions } from "../services/varos";
import { getMxnUsdRate } from "../fx/oracle";
import { voucherTransactions } from "./vouchers";

// ─── ALMACÉN DE CLIENTES SDK (en memoria para MVP) ─────────────────────────
// En producción: tabla sdk_clients en Prisma/Neon

interface SdkClient {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  webhookUrl?: string;
  isActive: boolean;
  totalTransactions: number;
  createdAt: Date;
}

const sdkClients = new Map<string, SdkClient>();

// ─── ALMACÉN DE TRANSACCIONES SDK (en memoria para MVP) ────────────────────
// Aquí se guardan las transacciones hechas vía /sdk/v1/transfer, mint, burn
// para que /sdk/v1/tx/:id pueda encontrarlas.

interface SdkTransaction {
  id: string;
  type: "TRANSFER" | "MINT" | "BURN";
  hederaTxId: string;
  hcsSequence: string;
  from: string;
  to: string;
  amount: number;
  protocolFee: number;
  status: string;
  createdAt: Date;
}

const sdkTransactions = new Map<string, SdkTransaction>();

// Generar API key única para cada fintech
function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let key = "sk_";
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// Validar API key de cliente SDK o TEST_API_KEY para desarrollo
function isValidApiKey(apiKey: string): boolean {
  // Aceptar TEST_API_KEY para desarrollo
  if (apiKey === process.env.TEST_API_KEY) return true;
  // Buscar en clientes registrados
  for (const client of sdkClients.values()) {
    if (client.apiKey === apiKey && client.isActive) return true;
  }
  return false;
}

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface RegisterBody {
  name: string;        // Nombre de la fintech
  email: string;       // Email de contacto
  webhookUrl?: string; // URL para notificaciones (opcional)
}

interface TransferBody {
  from: string;    // Account ID origen (0.0.XXXXX)
  to: string;      // Account ID destino
  amount: number;  // Monto en MXNH
}

interface MintBody {
  amount: number;       // Monto en MXNH a mintear
  accountId: string;    // Account ID destino
}

interface BurnBody {
  amount: number;       // Monto en MXNH a quemar
  accountId: string;    // Account ID origen
}

interface BalanceParams {
  id: string;  // Account ID de Hedera
}

interface TxParams {
  id: string;  // Transaction ID de Hedera
}

export default async function sdkRoutes(server: FastifyInstance) {

  // ─── MIDDLEWARE: Autenticación por API key ───────────────────────────────
  // Excepción: /sdk/v1/register usa SDK_ADMIN_KEY (solo admins pueden registrar)
  server.addHook("onRequest", async (request, reply) => {
    const url = request.url;

    // Register usa una key de admin diferente
    if (url === "/sdk/v1/register") {
      const adminKey = request.headers["x-admin-key"];
      if (!adminKey || adminKey !== process.env.SDK_ADMIN_KEY) {
        return reply.status(401).send({
          success: false,
          error: "No autorizado. x-admin-key inválida.",
        });
      }
      return;
    }

    // Todos los demás endpoints usan x-api-key del cliente SDK
    const apiKey = request.headers["x-api-key"] as string;
    if (!apiKey || !isValidApiKey(apiKey)) {
      return reply.status(401).send({
        success: false,
        error: "No autorizado. API key inválida o ausente.",
      });
    }
  });

  // ─── POST /sdk/v1/register ────────────────────────────────────────────────
  server.post<{ Body: RegisterBody }>(
    "/sdk/v1/register",
    async (request, reply) => {
      try {
        const { name, email, webhookUrl } = request.body;

        if (!name || !email) {
          return reply.status(400).send({
            success: false,
            error: "name y email son requeridos",
          });
        }

        for (const client of sdkClients.values()) {
          if (client.email === email) {
            return reply.status(409).send({
              success: false,
              error: "Ya existe un cliente con ese email",
            });
          }
        }

        const apiKey = generateApiKey();
        const client: SdkClient = {
          id: `sdk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name,
          email,
          apiKey,
          webhookUrl,
          isActive: true,
          totalTransactions: 0,
          createdAt: new Date(),
        };

        sdkClients.set(client.id, client);
        console.log(`🔑 Nuevo cliente SDK registrado: ${name} (${email})`);

        return {
          success: true,
          message: "Cliente SDK registrado exitosamente",
          data: {
            clientId: client.id,
            apiKey,
            name,
            email,
          },
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ success: false, error: error.message });
      }
    },
  );

  // ─── POST /sdk/v1/mint ──────────────────────────────────────────────────
  server.post<{ Body: MintBody }>("/sdk/v1/mint", async (request, reply) => {
    try {
      const { amount, accountId } = request.body;

      if (!amount || amount <= 0 || !accountId) {
        return reply.status(400).send({
          success: false,
          error: "amount (mayor a 0) y accountId son requeridos",
        });
      }

      const txId = await mintMXNH(amount, accountId);
      const feeValue = parseFloat((amount * 0.005).toFixed(2));

      const hcsSequence = await logTransaction({
        MsgType: "MINT",
        InstdAmt: { value: amount, currency: "MXN" },
        DbtrAcct: process.env.HEDERA_TREASURY_ID!,
        CdtrAcct: accountId,
        TxRef: txId,
        PrtclFee: {
          value: feeValue,
          collector: process.env.HEDERA_FEE_COLLECTOR_ID!,
        },
      });

      const sdkTx: SdkTransaction = {
        id: `sdk_tx_${Date.now()}`,
        type: "MINT",
        hederaTxId: txId,
        hcsSequence,
        from: process.env.HEDERA_TREASURY_ID!,
        to: accountId,
        amount,
        protocolFee: feeValue,
        status: "completed",
        createdAt: new Date(),
      };
      sdkTransactions.set(txId, sdkTx);

      console.log(`💰 SDK Mint: ${amount} MXNH → ${accountId} | HCS: ${hcsSequence}`);

      return {
        success: true,
        message: "Mint completado",
        data: {
          transactionId: txId,
          hcsSequence,
          accountId,
          amount,
          protocolFee: feeValue,
        },
      };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ─── POST /sdk/v1/burn ──────────────────────────────────────────────────
  server.post<{ Body: BurnBody }>("/sdk/v1/burn", async (request, reply) => {
    try {
      const { amount, accountId } = request.body;

      if (!amount || amount <= 0 || !accountId) {
        return reply.status(400).send({
          success: false,
          error: "amount (mayor a 0) y accountId son requeridos",
        });
      }

      const txId = await burnMXNH(amount, accountId);
      const feeValue = parseFloat((amount * 0.005).toFixed(2));

      const hcsSequence = await logTransaction({
        MsgType: "BURN",
        InstdAmt: { value: amount, currency: "MXN" },
        DbtrAcct: accountId,
        CdtrAcct: process.env.HEDERA_TREASURY_ID!,
        TxRef: txId,
        PrtclFee: {
          value: feeValue,
          collector: process.env.HEDERA_FEE_COLLECTOR_ID!,
        },
      });

      const sdkTx: SdkTransaction = {
        id: `sdk_tx_${Date.now()}`,
        type: "BURN",
        hederaTxId: txId,
        hcsSequence,
        from: accountId,
        to: process.env.HEDERA_TREASURY_ID!,
        amount,
        protocolFee: feeValue,
        status: "completed",
        createdAt: new Date(),
      };
      sdkTransactions.set(txId, sdkTx);

      console.log(`🔥 SDK Burn: ${amount} MXNH de ${accountId} | HCS: ${hcsSequence}`);

      return {
        success: true,
        message: "Burn completado",
        data: {
          transactionId: txId,
          hcsSequence,
          accountId,
          amount,
          protocolFee: feeValue,
        },
      };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ─── POST /sdk/v1/transfer ────────────────────────────────────────────────
  server.post<{ Body: TransferBody }>(
    "/sdk/v1/transfer",
    async (request, reply) => {
      try {
        const { from, to, amount } = request.body;

        if (!from || !to || !amount || amount <= 0) {
          return reply.status(400).send({
            success: false,
            error: "from, to y amount (mayor a 0) son requeridos",
          });
        }

        const txId = await mintMXNH(amount, to);
        const feeValue = parseFloat((amount * 0.005).toFixed(2));

        const hcsSequence = await logTransaction({
          MsgType: "TRANSFER",
          InstdAmt: { value: amount, currency: "MXN" },
          DbtrAcct: from,
          CdtrAcct: to,
          TxRef: txId,
          PrtclFee: {
            value: feeValue,
            collector: process.env.HEDERA_FEE_COLLECTOR_ID!,
          },
        });

        const sdkTx: SdkTransaction = {
          id: `sdk_tx_${Date.now()}`,
          type: "TRANSFER",
          hederaTxId: txId,
          hcsSequence,
          from,
          to,
          amount,
          protocolFee: feeValue,
          status: "completed",
          createdAt: new Date(),
        };
        sdkTransactions.set(txId, sdkTx);

        console.log(`📤 SDK Transfer: ${amount} MXNH ${from} → ${to} | HCS: ${hcsSequence}`);

        return {
          success: true,
          message: "Transferencia completada",
          data: {
            transactionId: txId,
            hcsSequence,
            from,
            to,
            amount,
            protocolFee: feeValue,
          },
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ success: false, error: error.message });
      }
    },
  );

  // ─── GET /sdk/v1/balance/:id ──────────────────────────────────────────────
  server.get<{ Params: BalanceParams }>(
    "/sdk/v1/balance/:id",
    async (request, reply) => {
      try {
        const { id } = request.params;
        const balance = await getBalance(id);

        return {
          success: true,
          data: {
            accountId: id,
            balance,
            currency: "MXNH",
          },
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ success: false, error: error.message });
      }
    },
  );

  // ─── GET /sdk/v1/rate ─────────────────────────────────────────────────────
  server.get("/sdk/v1/rate", async (request, reply) => {
    try {
      const rateData = await getMxnUsdRate();

      return {
        success: true,
        data: {
          rate: rateData.rate,
          rateWithSpread: rateData.rateWithSpread,
          source: rateData.source,
          spread: "0.3%",
          timestamp: rateData.timestamp,
        },
      };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ─── GET /sdk/v1/tx/:id ───────────────────────────────────────────────────
  // Busca en 3 stores: SDK directo, vouchers, y orquestador (Stripe).
  server.get<{ Params: TxParams }>("/sdk/v1/tx/:id", async (request, reply) => {
    try {
      const { id } = request.params;

      // 1. Buscar en transacciones del SDK (transfer, mint, burn directos)
      const sdkTx = sdkTransactions.get(id);
      if (sdkTx) {
        return {
          success: true,
          source: "sdk",
          data: {
            id: sdkTx.id,
            type: sdkTx.type,
            transactionId: sdkTx.hederaTxId,
            hcsSequence: sdkTx.hcsSequence,
            from: sdkTx.from,
            to: sdkTx.to,
            amount: sdkTx.amount,
            protocolFee: sdkTx.protocolFee,
            status: sdkTx.status,
            createdAt: sdkTx.createdAt,
          },
        };
      }

      // 2. Buscar en transacciones de vouchers (mint vía /voucher/create)
      const vTx = voucherTransactions.get(id);
      if (vTx) {
        return {
          success: true,
          source: "voucher",
          data: {
            id: vTx.id,
            type: vTx.type,
            transactionId: vTx.hederaTxId,
            hcsSequence: vTx.hcsSequence,
            amountMxnh: vTx.amountMxnh,
            amountUsd: vTx.amountUsd,
            exchangeRate: vTx.exchangeRate,
            protocolFee: vTx.protocolFee,
            voucherCode: vTx.voucherCode,
            receiverPhone: vTx.receiverPhone,
            status: vTx.status,
            createdAt: vTx.createdAt,
          },
        };
      }

      // 3. Buscar en transacciones del orquestador (flujo Stripe)
      const allTx = getAllTransactions();
      const found = allTx.find((tx) => tx.hederaTxId === id || tx.id === id);

      if (found) {
        return {
          success: true,
          source: "orchestrator",
          data: {
            id: found.id,
            transactionId: found.hederaTxId,
            status: found.status,
            amountUsd: found.amountUsd,
            amountMxnh: found.amountMxnh,
            exchangeRate: found.exchangeRate,
            protocolFee: found.protocolFee,
            hcsSequence: found.hcsMessageId,
            voucherCode: found.voucherCode,
            receiverPhone: found.receiverPhone,
            createdAt: found.createdAt,
          },
        };
      }

      return reply.status(404).send({
        success: false,
        error: "Transacción no encontrada",
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });
}
