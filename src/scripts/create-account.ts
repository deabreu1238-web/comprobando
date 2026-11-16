// Crea una cuenta con su usuario dueño, o un superadministrador.
//   npm run create-account -- --name "Mi negocio" --email dueño@mail.com --password "una-clave-larga"
//   npm run create-account -- --superadmin --email vos@mail.com --password "una-clave-larga"
import { parseArgs } from 'node:util';
import { config } from '../config.js';
import { createDb, migrate } from '../db.js';
import { hashPassword, randomToken } from '../crypto.js';

const { values } = parseArgs({
  options: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' }, superadmin: { type: 'boolean' } },
});
if (!values.email || !values.password || values.password.length < 10) {
  console.error('Uso: --email x@y.com --password "mínimo 10 caracteres" [--name "Negocio" | --superadmin]');
  process.exit(1);
}

const db = createDb(config.databaseUrl);
await migrate(db);
if (values.superadmin) {
  await db.query(`insert into users (email, password_hash, is_superadmin) values (lower($1), $2, true)`, [values.email, hashPassword(values.password)]);
  console.log(`Superadministrador creado: ${values.email}`);
} else {
  if (!values.name) {
    console.error('Falta --name con el nombre del negocio');
    process.exit(1);
  }
  const a = await db.query<{ id: string; public_key: string }>('insert into accounts (name, public_key) values ($1, $2) returning id, public_key', [
    values.name, randomToken(12),
  ]);
  await db.query(`insert into users (account_id, email, password_hash, role) values ($1, lower($2), $3, 'owner')`, [
    a.rows[0].id, values.email, hashPassword(values.password),
  ]);
  console.log(`Cuenta "${values.name}" creada (id ${a.rows[0].id}). Script de la landing: ${config.publicUrl}/t/${a.rows[0].public_key}.js`);
}
await db.end();
