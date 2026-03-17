import * as dotenv from "dotenv";
dotenv.config(); // Primero cargar variables de entorno

import Fastify from "fastify";
import hederaRoutes from "./routes/hedera";

const server = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
    },
  },
});

// Registramos las rutas de Hedera (una sola vez)
server.register(hederaRoutes);

server.get("/health", async (request, reply) => {
  return {
    status: "ok",
    message: "🚀 Varos MXNH Protocol API running",
  };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await server.listen({ port, host: "0.0.0.0" });
    console.log(`\n=================================================`);
    console.log(`🟢 Servidor activo en http://localhost:${port}`);
    console.log(`🔑 Mint: POST /hedera/test-mint`);
    console.log(`=================================================\n`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
