import { config } from './config.js';
import { createDb, migrate } from './db.js';
import { buildApp } from './server.js';
import { claudeReceiptAnalyzer } from './services/receipts.js';
import type { Deps } from './services/engine.js';

const db = createDb(config.databaseUrl);
const applied = await migrate(db);
if (applied.length) console.log('Migraciones aplicadas:', applied.join(', '));

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
