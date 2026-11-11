import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool.js';

const migrationsDir = fileURLToPath(new URL('../migrations/', import.meta.url));

async function main() {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('dict_logsheet_migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query('SELECT version, checksum FROM schema_migrations');
    const applied = new Map(rows.map((row) => [row.version, row.checksum]));

    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
    let count = 0;

    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');

      if (applied.has(file)) {
        if (applied.get(file) !== checksum) {
          throw new Error(`Migration ${file} changed after being applied. Create a new migration instead.`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [
          file,
          checksum,
        ]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }

      console.log(`applied ${file}`);
      count += 1;
    }

    console.log(count ? `${count} migration(s) applied.` : 'Database is up to date.');
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('dict_logsheet_migrations'))")
      .catch(() => {});
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
