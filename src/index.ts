import Fastify from 'fastify';
import cors from '@fastify/cors';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const server = Fastify({
  logger: true // Útil para ver logs de las peticiones en consola
});

// Registrar CORS para permitir peticiones del frontend
server.register(cors);

// Endpoint de Health Check
server.get('/health', async (request, reply) => {
  return 'Varos MXNH Protocol API running';
});

// Inicialización del servidor
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Protocolo Varos corriendo en http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
