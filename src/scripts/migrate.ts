import { config } from '../config.js';
import { createDb, migrate } from '../db.js';

const db = createDb(config.databaseUrl);
const applied = await migrate(db);
console.log(applied.length ? `Aplicadas: ${applied.join(', ')}` : 'La base ya está al día.');
await db.end();
