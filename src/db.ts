import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Db = pg.Pool;

export function createDb(databaseUrl: string): Db {
  const ssl = /sslmode=require|supabase\.co|render\.com|railway/.test(databaseUrl) ? { rejectUnauthorized: false } : undefined;
  return new pg.Pool({ connectionString: databaseUrl, ssl, max: 10 });
}

const here = path.dirname(fileURLToPath(import.meta.url));

/** Aplica en orden las migraciones de /migrations que todavía no corrieron. */
export async function migrate(db: Db, dir = path.resolve(here, '..', 'migrations')): Promise<string[]> {
  await db.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const done = new Set((await db.query<{ name: string }>('select name from schema_migrations')).rows.map(r => r.name));
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await client.query('insert into schema_migrations (name) values ($1)', [f]);
      await client.query('commit');
      applied.push(f);
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }
  return applied;
}
