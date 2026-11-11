import os from 'node:os';
import pg from 'pg';
import { config } from '../config.js';

export function buildPoolConfig() {
  if (config.database.url) {
    return { connectionString: config.database.url };
  }
  return {
    host: config.database.socket || '/run/postgresql',
    database: config.database.name,
    user: config.database.user || os.userInfo().username,
  };
}

export const pool = new pg.Pool(buildPoolConfig());
