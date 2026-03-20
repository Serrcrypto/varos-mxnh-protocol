// ============================================================
// src/routes/fx.ts
// Endpoint público para consultar el tipo de cambio actual.
// Útil para el frontend, el SDK, y el dashboard.
// ============================================================

import { FastifyInstance } from "fastify";
import { getMxnUsdRate } from "../fx/oracle";

export default async function fxRoutes(server: FastifyInstance) {

  // ─── GET /fx/rate ─────────────────────────────────────────────────────────
  // Devuelve el tipo de cambio actual MXN/USD con metadata.
  // Endpoint público — no requiere autenticación.
  // Respuesta incluye: precio, precio con spread, fuente, y timestamp.
  server.get("/fx/rate", async (request, reply) => {
    try {
      const rateData = await getMxnUsdRate();

      return {
        success: true,
        data: {
          pair: "MXN/USD",
          rate: rateData.rate,
          rateWithSpread: rateData.rateWithSpread,
          spread: `${(rateData.spread * 100).toFixed(1)}%`,
          source: rateData.source,
          timestamp: rateData.timestamp,
          cachedUntil: rateData.cachedUntil,
        },
      };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });
}
