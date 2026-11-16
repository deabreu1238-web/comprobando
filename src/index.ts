import { config } from './config.js';
import { createDb, migrate } from './db.js';
import { buildApp } from './server.js';
import { hashPassword } from './crypto.js';
import { claudeReceiptAnalyzer } from './services/receipts.js';
import type { Deps } from './services/engine.js';

const db = createDb(config.databaseUrl);
const applied = await migrate(db);
if (applied.length) console.log('Migraciones aplicadas:', applied.join(', '));

if (config.adminEmail && config.adminPassword) {
  const exists = await db.query('select 1 from users where is_superadmin limit 1');
  if (!exists.rowCount) {
    if (config.adminPassword.length < 10) throw new Error('ADMIN_PASSWORD tiene que tener al menos 10 caracteres');
    await db.query('insert into users (email, password_hash, is_superadmin) values (lower($1), $2, true)', [config.adminEmail, hashPassword(config.adminPassword)]);
    console.log(`Superadministrador creado: ${config.adminEmail}. Ya podés borrar ADMIN_PASSWORD de las variables.`);
  }
}

const deps: Deps = {
  db,
  encryptionKey: config.encryptionKey,
  metaApiVersion: config.metaApiVersion,
  analyzer: claudeReceiptAnalyzer(config.receiptModel),
  fetch,
  log: (msg, extra) => console.log(JSON.stringify({ level: 'info', msg, ...extra })),
};

const app = await buildApp(deps, { publicUrl: config.publicUrl, cookieSecure: config.cookieSecure, logger: true });
await app.listen({ port: config.port, host: '0.0.0.0' });
