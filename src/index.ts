import * as dotenv from "dotenv";
dotenv.config();

import Fastify from "fastify";
import rawBody from "fastify-raw-body";
import hederaRoutes from "./routes/hedera";
import paymentRoutes from "./routes/payments";
import voucherRoutes from "./routes/vouchers";
import offrampRoutes from "./routes/offramp";
import fxRoutes from "./routes/fx";
import sdkRoutes from "./routes/sdk";
import cors from "@fastify/cors";

const server = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
    },
  },
});

// Raw body necesario para verificar la firma del webhook de Stripe
server.register(rawBody, {
  field: "rawBody",
  global: false,
  runFirst: true,
});

server.register(hederaRoutes);
server.register(paymentRoutes);
server.register(voucherRoutes);
server.register(offrampRoutes);
server.register(fxRoutes);
server.register(sdkRoutes);
server.register(cors, { origin: true });

server.get("/health", async (request, reply) => {
  return { status: "ok", message: "🚀 Varos MXNH Protocol API running" };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await server.listen({ port, host: "0.0.0.0" });
    console.log(`\n=================================================`);
    console.log(`🟢 Servidor activo en http://localhost:${port}`);
    console.log(`🔑 Mint: POST /hedera/test-mint`);
    console.log(`💳 Pagos: POST /payments/create-intent`);
    console.log(`=================================================\n`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
