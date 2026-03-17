import { FastifyPluginAsync } from "fastify";
import { mintMXNH, burnMXNH, getBalance } from "../hedera/token";
import { logTransaction } from "../hedera/hcs";
import { publishReserveProof } from "../hedera/reserve";

// --- Interfaces para el tipado explícito ---

interface MintBody {
  amount: number;
  receiverAccountId: string;
}

interface BurnBody {
  amount: number;
  accountId: string;
}

interface BalanceParams {
  accountId: string;
}

// Interfaz básica basada en el contexto que diste.
// Ajusta según cómo esté definida tu interfaz Iso20022Message real.
interface Iso20022MessageMock {
  MsgType: "MINT" | "BURN";
  PrtclFee: {
    value: number;
    collector: string | undefined;
  };
  // ... otras propiedades que requiera tu tipo real
}

const hederaRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Middleware / Hook de Autenticación
  fastify.addHook("onRequest", async (request, reply) => {
    const apiKey = request.headers["x-api-key"];

    if (!apiKey || apiKey !== process.env.TEST_API_KEY) {
      return reply.status(401).send({
        success: false,
        error: "No autorizado. x-api-key inválida o ausente.",
      });
    }
  });

  // 2. POST /hedera/test-mint
  fastify.post<{ Body: MintBody }>(
    "/hedera/test-mint",
    async (request, reply) => {
      try {
        const { amount, receiverAccountId } = request.body;

        const transactionId = await mintMXNH(amount, receiverAccountId);
        const feeValue = parseFloat((amount * 0.005).toFixed(2));

        // TEMPORAL: debug
        console.log("FEE_COLLECTOR_ID:", process.env.HEDERA_FEE_COLLECTOR_ID);
        console.log("feeValue:", feeValue);
        console.log("PrtclFee que se enviará:", {
          value: feeValue,
          collector: process.env.HEDERA_FEE_COLLECTOR_ID,
        });

        const hcsSequence = await logTransaction({
          MsgType: "MINT",
          InstdAmt: { value: amount, currency: "MXN" },
          DbtrAcct: process.env.HEDERA_TREASURY_ID || null,
          CdtrAcct: receiverAccountId || null,
          TxRef: transactionId,
          PrtclFee: {
            value: feeValue,
            collector: process.env.HEDERA_FEE_COLLECTOR_ID!,
          },
        });

        return reply.send({ success: true, transactionId, hcsSequence });
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "Error desconocido al emitir MXNH";
        return reply.status(500).send({ success: false, error: message });
      }
    },
  );

  // 3. POST /hedera/test-burn
  fastify.post<{ Body: BurnBody }>(
    "/hedera/test-burn",
    async (request, reply) => {
      try {
        const { amount, accountId } = request.body;

        const transactionId = await burnMXNH(amount, accountId);
        const feeValue = parseFloat((amount * 0.005).toFixed(2));

        const hcsSequence = await logTransaction({
          MsgType: "BURN",
          InstdAmt: { value: amount, currency: "MXN" },
          DbtrAcct: accountId || null,
          CdtrAcct: process.env.HEDERA_TREASURY_ID || null,
          TxRef: transactionId,
          PrtclFee: {
            value: feeValue,
            collector: process.env.HEDERA_FEE_COLLECTOR_ID!,
          },
        });

        return reply.send({ success: true, transactionId, hcsSequence });
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "Error desconocido al quemar MXNH";
        return reply.status(500).send({ success: false, error: message });
      }
    },
  );

  // 4. GET /hedera/balance/:accountId
  fastify.get<{ Params: BalanceParams }>(
    "/hedera/balance/:accountId",
    async (request, reply) => {
      try {
        const { accountId } = request.params;

        const balance = await getBalance(accountId);

        return reply.send({ accountId, balance });
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "Error al obtener el balance";
        return reply.status(500).send({ success: false, error: message });
      }
    },
  );

  // 5. GET /hedera/reserve
  fastify.get("/hedera/reserve", async (request, reply) => {
    try {
      // Valores de prueba solicitados
      const totalMxnh = 1000;
      const totalMxnReserve = 1000;

      const result = await publishReserveProof(totalMxnh, totalMxnReserve);

      return reply.send(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Error al publicar la prueba de reserva";
      return reply.status(500).send({ success: false, error: message });
    }
  });
};

export default hederaRoutes;
