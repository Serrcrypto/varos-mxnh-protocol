// ============================================================
// src/routes/hedera.ts
// Endpoints de prueba para interactuar con Hedera desde Postman.
// Todos requieren el header x-api-key para estar protegidos.
// ============================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { mintMXNH, burnMXNH, getBalance } from "../hedera/token";
import { logTransaction } from "../hedera/hcs";

// --- Tipos de los cuerpos (body) que esperan los endpoints POST ---

// Lo que debe venir en el body de /test-mint
interface MintBody {
  amount: number; // Cantidad de MXNH a acuñar
  receiverAccountId?: string; // Cuenta destino (opcional, si no se pasa va a Tesorería)
}

// Lo que debe venir en el body de /test-burn
interface BurnBody {
  amount: number; // Cantidad de MXNH a quemar
  accountId?: string; // Cuenta de origen (opcional)
}

// Parámetro de URL para /balance/:accountId
interface Params {
  accountId: string; // ID de cuenta Hedera formato 0.0.XXXXX
}

// Forma que esperamos de la respuesta del Mirror Node de Hedera
// El Mirror Node es la API pública de lectura de Hedera (no cobra)
interface MirrorNodeResponse {
  messages?: Array<{
    consensus_timestamp: string; // Cuándo se registró el mensaje
    sequence_number: number; // Número de secuencia en el topic HCS
    message: string; // Contenido en Base64 (hay que decodificarlo)
  }>;
}

// Plugin de Fastify: agrupa las 4 rutas bajo el mismo middleware de autenticación
export default async function hederaRoutes(server: FastifyInstance) {
  // ─── MIDDLEWARE DE SEGURIDAD ───────────────────────────────────────────────
  // Este hook se ejecuta ANTES de cada request en este plugin.
  // Si el header x-api-key no coincide con TEST_API_KEY del .env, rechaza con 401.
  server.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const apiKey = request.headers["x-api-key"];
      const validKey = process.env.TEST_API_KEY;
      if (!apiKey || apiKey !== validKey) {
        reply.status(401).send({
          success: false,
          error: "No autorizado. x-api-key inválida o ausente.",
        });
      }
    },
  );

  // ─── POST /hedera/test-mint ────────────────────────────────────────────────
  // Acuña MXNH en Hedera y registra la operación en HCS con formato ISO 20022.
  // Ejemplo body: { "amount": 100, "receiverAccountId": "0.0.8252102" }
  server.post<{ Body: MintBody }>(
    "/hedera/test-mint",
    async (request, reply) => {
      try {
        const { amount, receiverAccountId } = request.body;

        // Validación básica: no tiene sentido mintear 0 o negativos
        if (!amount || amount <= 0) {
          return reply
            .status(400)
            .send({ error: "El monto debe ser mayor a 0" });
        }

        // 1. Acuñar tokens MXNH en Hedera Token Service (HTS)
        //    Devuelve el transactionId de Hedera (ej: "0.0.8214279@1773716712.096")
        const txId = await mintMXNH(amount, receiverAccountId);

        // 2. Calcular el fee del protocolo: 0.5% del monto
        //    Este fee ya fue cobrado automáticamente por HTS gracias al
        //    CustomFractionalFee configurado en el token. Aquí solo lo calculamos
        //    para dejarlo registrado en el mensaje HCS como evidencia.
        const feeValue = parseFloat((amount * 0.005).toFixed(2));

        // 3. Publicar mensaje de auditoría en HCS con estructura ISO 20022
        //    Esto crea un registro inmutable en la blockchain de Hedera.
        //    DbtrAcct = cuenta que emite (Tesorería)
        //    CdtrAcct = cuenta que recibe los tokens
        //    PrtclFee = fee cobrado por el protocolo Varos (0.5%)
        const hcsMessageId = await logTransaction({
          MsgType: "MINT",
          InstdAmt: { value: amount, currency: "MXN" },
          DbtrAcct: process.env.HEDERA_TREASURY_ID || null,
          CdtrAcct: receiverAccountId || process.env.HEDERA_TREASURY_ID || null,
          TxRef: txId,
          PrtclFee: {
            value: feeValue,
            collector: process.env.HEDERA_FEE_COLLECTOR_ID!, // ! = TypeScript: "confía, existe en .env"
          },
        });

        // Devolver confirmación con los IDs para verificar en hashscan.io
        return {
          success: true,
          message: "MXNH acuñado exitosamente",
          data: { transactionId: txId, hcsSequence: hcsMessageId },
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ success: false, error: error.message });
      }
    },
  );

  // ─── POST /hedera/test-burn ────────────────────────────────────────────────
  // Quema MXNH en Hedera (reduce el supply) y registra en HCS.
  // Esto ocurre cuando un usuario cobra en OXXO o vía SPEI — el MXNH se destruye.
  // Ejemplo body: { "amount": 50, "accountId": "0.0.8252102" }
  server.post<{ Body: BurnBody }>(
    "/hedera/test-burn",
    async (request, reply) => {
      try {
        const { amount, accountId } = request.body;

        if (!amount || amount <= 0) {
          return reply
            .status(400)
            .send({ error: "El monto debe ser mayor a 0" });
        }

        // 1. Quemar tokens en HTS — reduce el supply total de MXNH
        const txId = await burnMXNH(amount, accountId);

        // 2. Fee del protocolo también aplica en quema
        const feeValue = parseFloat((amount * 0.005).toFixed(2));

        // 3. Registrar en HCS
        //    DbtrAcct = cuenta de donde venían los tokens antes de quemar
        //    CdtrAcct = null porque los tokens se destruyen, no van a nadie
        const hcsMessageId = await logTransaction({
          MsgType: "BURN",
          InstdAmt: { value: amount, currency: "MXN" },
          DbtrAcct: accountId || process.env.HEDERA_TREASURY_ID || null,
          CdtrAcct: null,
          TxRef: txId,
          PrtclFee: {
            value: feeValue,
            collector: process.env.HEDERA_FEE_COLLECTOR_ID!,
          },
        });

        return {
          success: true,
          message: "MXNH quemado exitosamente",
          data: { transactionId: txId, hcsSequence: hcsMessageId },
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ success: false, error: error.message });
      }
    },
  );

  // ─── GET /hedera/balance/:accountId ───────────────────────────────────────
  // Consulta cuántos MXNH tiene una cuenta.
  // Ejemplo: GET /hedera/balance/0.0.8252102
  server.get<{ Params: Params }>(
    "/hedera/balance/:accountId",
    async (request, reply) => {
      try {
        const { accountId } = request.params;
        const balance = await getBalance(accountId);
        return {
          success: true,
          data: { accountId, balanceMXNH: balance },
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ success: false, error: error.message });
      }
    },
  );

  // ─── GET /hedera/reserve ──────────────────────────────────────────────────
  // Devuelve la última prueba de reserva publicada en HCS.
  // En lugar de llamar a publishReserveProof(), lee directamente del Mirror Node
  // para mostrar lo que ya está on-chain — más honesto para un dashboard público.
  server.get("/hedera/reserve", async (request, reply) => {
    try {
      const topicId = process.env.HEDERA_HCS_TOPIC_ID;
      if (!topicId) throw new Error("HEDERA_HCS_TOPIC_ID no configurado");

      // Mirror Node = API REST pública de Hedera para leer datos sin firmar transacciones
      const url = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?order=desc&limit=1`;
      const response = await fetch(url);

      if (!response.ok)
        throw new Error("Error conectando al Hedera Mirror Node");

      const data = (await response.json()) as MirrorNodeResponse;

      // Si el topic está vacío todavía
      if (!data.messages || data.messages.length === 0) {
        return {
          success: true,
          message: "No hay pruebas de reserva publicadas aún.",
        };
      }

      // El Mirror Node devuelve el contenido del mensaje en Base64 — hay que decodificarlo
      const decodedMessage = Buffer.from(
        data.messages[0].message,
        "base64",
      ).toString("utf-8");
      const parsedIsoMessage = JSON.parse(decodedMessage);

      // El último mensaje podría ser un MINT o BURN, no necesariamente una reserva
      if (parsedIsoMessage.MsgType !== "RESERVE_PROOF") {
        return {
          success: true,
          message: "El último mensaje en HCS no es una prueba de reserva.",
          latestLog: parsedIsoMessage,
        };
      }

      // Si sí es RESERVE_PROOF, devolver los datos completos
      return {
        success: true,
        data: {
          sequenceNumber: data.messages[0].sequence_number,
          timestamp: data.messages[0].consensus_timestamp,
          proof: parsedIsoMessage,
        },
      };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });
}
