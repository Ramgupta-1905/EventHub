import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
dotenv.config({ path: envPath });

const defaultConfig = {
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@eventhub.local',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  jwtSecret: process.env.JWT_SECRET || '',
  dataDir: process.env.DATA_DIR || null,
  nodeEnv: process.env.NODE_ENV || 'development',
};

export function getConfig(overrides = {}) {
  return {
    ...defaultConfig,
    ...overrides,
  };
}
