import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

// Requerido en Node.js para que Neon use WebSockets
neonConfig.webSocketConstructor = ws;

// Asegurarnos de que la URL existe
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no está definida en el archivo .env');
}

// Configurar el Pool de conexiones de Neon
const pool = new Pool({ connectionString });

// Inicializar el adaptador
const adapter = new PrismaNeon(pool);

// Exportar una única instancia de Prisma Client
export const prisma = new PrismaClient({ adapter });
