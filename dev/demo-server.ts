// Servidor de demostración local: datos de ejemplo e IA/Meta/Kommo simulados. No se usa en producción.
import { createDb, migrate } from '../src/db.js';
import { buildApp } from '../src/server.js';
import { hashPassword, randomToken, encrypt } from '../src/crypto.js';
import { handleKommoWebhook } from '../src/routes/kommo.js';
import type { Deps } from '../src/services/engine.js';

const KEY = Buffer.alloc(32, 9).toString('base64');
const db = createDb(process.env.DATABASE_URL ?? 'postgres://comprobado:comprobado@127.0.0.1:5432/comprobado_dev');
await db.query('drop schema public cascade; create schema public;');
await migrate(db);
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
let n = 0;
const readings = [
  { amount: 25000, operation_id: '84219904123', bank_or_wallet: 'Mercado Pago', confidence: 0.96, recipient_name: 'Nubecalm SRL', notes: 'Sin observaciones' },
  { amount: 18500.5, operation_id: '00071234', bank_or_wallet: 'Banco Galicia', confidence: 0.62, recipient_name: 'Nubecalm SRL', notes: 'La imagen está recortada y no se ve la hora.' },
  { amount: 42000, operation_id: 'TX-55120', bank_or_wallet: 'Ualá', confidence: 0.93, recipient_name: 'Martín Gómez', notes: 'Sin observaciones' },
];
const deps: Deps = {
  db, encryptionKey: KEY, metaApiVersion: 'v21.0', log: () => {},
  fetch: (async (input: any) => {
    const url = String(input);
    if (url.includes('graph.facebook.com')) return Response.json({ events_received: 1 });
    if (url.includes('/contacts/')) return Response.json({ name: 'Cliente', custom_fields_values: [{ field_code: 'PHONE', values: [{ value: '1155551234' }] }] });
    return new Response(JPEG, { headers: { 'content-type': 'image/jpeg' } });
  }) as typeof fetch,
  analyzer: async () => ({ is_payment_receipt: true, currency: 'ARS', date: '2026-11-16 15:02', payer_name: 'Juan Pérez', recipient_account: null, ...readings[n++ % readings.length] }),
};
const app = await buildApp(deps, { publicUrl: 'http://127.0.0.1:3999', cookieSecure: false });
const pk = randomToken(12);
const a = (await db.query<{ id: string }>(`insert into accounts (name, public_key, recipient_keywords) values ('Nubecalm', $1, '{nubecalm}') returning id`, [pk])).rows[0].id;
await db.query(`insert into users (account_id, email, password_hash) values ($1, 'demo@comprobado.app', $2)`, [a, hashPassword('demo-demo-123')]);
await db.query(`insert into users (email, password_hash, is_superadmin) values ('admin@comprobado.app', $1, true)`, [hashPassword('demo-demo-123')]);
await db.query(`insert into lines (account_id, label, phone, weight) values ($1, 'Línea 1', '5491155789187', 1), ($1, 'Línea 2', '5491130539854', 2)`, [a]);
await db.query(`insert into meta_configs (account_id, pixel_id, capi_token_enc) values ($1, '985938324124371', $2)`, [a, encrypt('EAAB' + 'x'.repeat(40), KEY)]);
await db.query(`insert into kommo_configs (account_id, base_url, token_enc, webhook_secret) values ($1, 'https://nubecalm.kommo.com', $2, $3)`, [a, encrypt('k'.repeat(60), KEY), randomToken(24)]);
const lines = (await db.query<{ id: string }>('select id from lines where account_id = $1', [a])).rows;
const ads = ['video-fundador', 'video-caidas', 'video-plataforma', 'video-testimonio'];
for (let i = 0; i < 46; i++) {
  const code = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.split('').sort(() => Math.random() - 0.5).slice(0, 8).join('');
  await db.query(`insert into leads (account_id, code, line_id, fbc, fbp, utm_source, utm_campaign, utm_content, landing_url, created_at, first_message_at, status)
    values ($1,$2,$3,$4,'fb.1.1.1','meta','Test videos', $5, 'https://panelproads.netlify.app/', now() - ($6 || ' hours')::interval, case when $7 then now() - ($6 || ' hours')::interval + interval '2 minutes' end, case when $7 then 'contacted' else 'clicked' end)`,
    [a, code, lines[i % 2].id, 'fb.1.1.IwAR' + i, ads[i % 4], String(i * 5), i % 3 !== 0]);
  if (i < 3) {
    await handleKommoWebhook(deps, a, { 'message[add][0][id]': 't' + i, 'message[add][0][type]': 'incoming', 'message[add][0][text]': 'mi código es ' + code, 'message[add][0][entity_type]': 'lead', 'message[add][0][entity_id]': String(100 + i) });
    await handleKommoWebhook(deps, a, { 'message[add][0][id]': 'i' + i, 'message[add][0][type]': 'incoming', 'message[add][0][entity_type]': 'lead', 'message[add][0][entity_id]': String(100 + i), 'message[add][0][attachment][type]': 'picture', 'message[add][0][attachment][link]': 'https://x/a.jpg' });
  }
}
const first = (await db.query<{ id: string }>(`select id from sales where amount = 25000`)).rows[0];
await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'demo@comprobado.app', password: 'demo-demo-123' } });
const { approveSale } = await import('../src/services/engine.js');
await approveSale(deps, a, first.id);
await db.query(`insert into webhook_events (account_id, provider, payload, result) values ($1, 'kommo', '{}', 'código XK4P2M9A vinculado al negocio 101 | imagen procesada: accepted')`, [a]);
await app.listen({ port: 3999, host: '127.0.0.1' });
console.log('demo lista en http://127.0.0.1:3999');
