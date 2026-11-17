import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import os from 'node:os';

const database = `dict_logsheet_test_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const baseConfig = {
  host: process.env.DATABASE_SOCKET || '/run/postgresql',
  user: process.env.DATABASE_USER || os.userInfo().username,
  database: 'postgres',
};
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: '',
  DATABASE_NAME: database,
};

async function main() {
  const admin = new pg.Client(baseConfig);
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0`);
  await admin.end();

  try {
    for (const script of ['migrate.js', 'seed.js']) {
      const result = spawnSync(process.execPath, [`scripts/${script}`], {
        cwd: new URL('..', import.meta.url),
        env,
        stdio: 'inherit',
      });
      if (result.status !== 0) process.exit(result.status || 1);
    }

    const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run'], {
      cwd: new URL('..', import.meta.url),
      env,
      stdio: 'inherit',
    });
    process.exit(result.status ?? 1);
  } finally {
    const cleanup = new pg.Client(baseConfig);
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await cleanup.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
