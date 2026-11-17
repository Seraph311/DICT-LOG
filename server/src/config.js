import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

const env = process.env;

export const config = {
  port: Number(env.PORT) || 4000,
  nodeEnv: env.NODE_ENV || 'development',
  clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
  trustProxy: env.TRUST_PROXY || 'loopback',
  jwtSecret: env.JWT_SECRET || '',
  seedDemoPassword: env.SEED_DEMO_PASSWORD || 'Demo#2026',
  database: {
    url: env.DATABASE_URL || '',
    socket: env.DATABASE_SOCKET || '',
    name: env.DATABASE_NAME || 'dict_logsheet',
    user: env.DATABASE_USER || '',
  },
};

export const isProduction = config.nodeEnv === 'production';
