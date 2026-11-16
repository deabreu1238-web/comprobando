// Prueba de punta a punta: clic en la landing -> chat en Kommo con el código -> comprobante -> venta -> Meta.
// Usa una base Postgres real (TEST_DATABASE_URL) y simula Kommo, Meta y la IA.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { createDb, migrate, type Db } from '../src/db.js';
import { buildApp } from '../src/server.js';
import { hashPassword, randomToken } from '../src/crypto.js';
import type { Deps } from '../src/services/engine.js';
import type { ReceiptReading } from '../src/services/receipts.js';
import { handleKommoWebhook } from '../src/routes/kommo.js';

const DB_URL = process.env.TEST_DATABASE_URL ?? 'postgres://comprobado:comprobado@127.0.0.1:5432/comprobado_test';
const KEY = Buffer.alloc(32, 7).toString('base64');
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);

let db: Db;
let app: FastifyInstance;
let cookie = '';
let accountId = '';
let publicKey = '';

// Lo que "lee" la IA en cada prueba
let nextReading: ReceiptReading | null = null;
const reading = (over: Partial<ReceiptReading> = {}): ReceiptReading => ({
  is_payment_receipt: true, amount: 25000, currency: 'ARS', date: '2026-11-16 15:02', bank_or_wallet: 'Mercado Pago',
  operation_id: randomToken(6), payer_name: 'Juan Pérez', recipient_name: 'Tienda Nube Calm', recipient_account: 'nubecalm.mp',
  confidence: 0.95, notes: 'Sin observaciones', ...over,
});

// Simulación de servicios externos
const metaCalls: { url: string; body: any }[] = [];
const fakeFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith('https://graph.facebook.com/')) {
    metaCalls.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ events_received: 1, fbtrace_id: 'x' }), { status: 200 });
  }
  if (url.includes('/api/v4/contacts/')) {
    return Response.json({ name: 'Juan Pérez', custom_fields_values: [{ field_code: 'PHONE', values: [{ value: '+54 9 11 5555-1234' }] }] });
  }
  if (url.includes('/api/v4/leads/pipelines')) {
    return Response.json({ _embedded: { pipelines: [{ id: 1, _embedded: { statuses: [{ id: 10, name: 'Nuevo' }, { id: 77, name: 'Compró ✅' }, { id: 142, name: 'Logrado con éxito' }] } }] } });
  }
  if (url.includes('/api/v4/leads/')) return Response.json({ id: 1, price: 40000 });
  if (url.startsWith('https://files.kommo.test/')) return new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  throw new Error(`fetch inesperado: ${url}`);
};

const deps = (): Deps => ({
  db, encryptionKey: KEY, metaApiVersion: 'v21.0', fetch: fakeFetch, log: () => {},
  analyzer: async () => nextReading,
});

async function api(method: string, url: string, payload?: unknown) {
  const res = await app.inject({ method: method as never, url, payload: payload as never, headers: { cookie } });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}

async function click(utm = 'video1') {
  const body = JSON.stringify({ k: publicKey, fbclid: `IwAR${randomToken(8)}`, fbp: 'fb.1.123.456', url: 'https://landing.test/?utm_content=' + utm, utm: { utm_source: 'meta', utm_campaign: 'Test', utm_content: utm } });
  const res = await app.inject({ method: 'POST', url: '/api/public/click', payload: body, headers: { 'content-type': 'text/plain', 'user-agent': 'iPhone' } });
  assert.equal(res.statusCode, 200, res.body);
  return JSON.parse(res.body).code as string;
}

const kommoMsg = (fields: Record<string, string>) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [`message[add][0][${k}]`, v]));

before(async () => {
  db = createDb(DB_URL);
  await db.query('drop schema public cascade; create schema public;');
  await migrate(db);
  app = await buildApp(deps(), { publicUrl: 'https://app.test', cookieSecure: false });
  publicKey = randomToken(12);
  const a = await db.query<{ id: string }>('insert into accounts (name, public_key) values ($1, $2) returning id', ['Nubecalm', publicKey]);
  accountId = a.rows[0].id;
  await db.query(`insert into users (account_id, email, password_hash) values ($1, 'duenio@test.com', $2)`, [accountId, hashPassword('clave-super-segura')]);
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'duenio@test.com', password: 'clave-super-segura' } });
  assert.equal(login.statusCode, 200);
  cookie = String(login.headers['set-cookie']).split(';')[0];
});

after(async () => {
  await app.close();
  await db.end();
});

test('configuración: líneas, Meta y Kommo', async () => {
  assert.equal((await api('POST', '/api/lines', { label: 'Línea 1', phone: '+54 9 11 5578-9187' })).status, 200);
  assert.equal((await api('POST', '/api/lines', { label: 'Línea 2', phone: '5491130539854', weight: 2 })).status, 200);
  assert.equal((await api('POST', '/api/lines', { label: 'Repetida', phone: '5491130539854' })).status, 400);
  assert.equal((await api('PUT', '/api/integrations/meta', { pixel_id: '985938324124371', capi_token: 'EAAB' + 'x'.repeat(40), test_event_code: 'TEST123' })).status, 200);
  assert.equal((await api('PUT', '/api/integrations/kommo', { base_url: 'https://miempresa.kommo.com', token: 'k'.repeat(60) })).status, 200);
  const integ = await api('GET', '/api/integrations');
  assert.equal(integ.body.meta.has_token, true);
  assert.match(integ.body.kommo.webhook_url, /^https:\/\/app\.test\/webhooks\/kommo\/[0-9a-f-]{36}\//);
  assert.match(integ.body.landing.snippet, /openRandomLink\(\)/);
  // el token nunca vuelve al navegador
  assert.ok(!JSON.stringify(integ.body).includes('EAAB'));
});

test('script de la landing: rota los números activos y carga el píxel', async () => {
  const res = await app.inject({ method: 'GET', url: `/t/${publicKey}.js` });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'] as string, /javascript/);
  assert.ok(res.body.includes('5491155789187') && res.body.includes('5491130539854'));
  assert.ok(res.body.includes('985938324124371'));
  assert.ok(res.body.includes('window.openRandomLink'));
  // el script tiene que ser JavaScript válido
  assert.doesNotThrow(() => new Function(res.body));
  assert.equal((await app.inject({ method: 'GET', url: '/t/clave-falsa.js' })).statusCode, 404);
});

test('flujo completo con aprobación manual: clic -> código en Kommo -> comprobante -> aprobar -> Purchase en Meta', async () => {
  const code = await click('video1');
  const lead = (await db.query('select * from leads where code = $1', [code])).rows[0];
  assert.match(lead.fbc, /^fb\.1\.\d+\.IwAR/);
  assert.equal(lead.utm_content, 'video1');

  // 1) el cliente escribe "mi código es XXXX" en WhatsApp (Kommo)
  let log = await handleKommoWebhook(deps(), accountId, kommoMsg({ id: 'm1', type: 'incoming', text: `Hola! mi código es ${code}`, entity_type: 'lead', entity_id: '555', contact_id: '777' }));
  assert.ok(log.some(l => l.includes(`código ${code} vinculado`)), log.join('|'));
  const linked = (await db.query('select * from leads where code = $1', [code])).rows[0];
  assert.equal(linked.kommo_lead_id, '555');
  assert.equal(linked.status, 'contacted');
  assert.equal(linked.customer_phone, '+54 9 11 5555-1234');

  // 2) manda la foto del comprobante
  nextReading = reading({ amount: 25000, operation_id: 'OP-1001' });
  log = await handleKommoWebhook(deps(), accountId, kommoMsg({ id: 'm2', type: 'incoming', text: '', entity_type: 'lead', entity_id: '555', 'attachment][type': 'picture', 'attachment][link': 'https://files.kommo.test/a.jpg' }));
  assert.ok(log.some(l => l.includes('imagen procesada: accepted')), log.join('|'));

  // 3) la venta queda pendiente de aprobación (modo manual) y todavía no se envió a Meta
  const pending = (await api('GET', '/api/sales?status=pending')).body;
  assert.equal(pending.length, 1);
  assert.equal(pending[0].amount, 25000);
  assert.equal(pending[0].code, code);
  assert.equal(metaCalls.length, 0);
  const img = await app.inject({ method: 'GET', url: `/api/receipts/${pending[0].receipt_id}/image`, headers: { cookie } });
  assert.equal(img.headers['content-type'], 'image/jpeg');

  // 4) se aprueba y sale el Purchase con los datos del clic original
  const ok = await api('POST', `/api/sales/${pending[0].id}/approve`, {});
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.capi_status, 'sent');
  assert.equal(metaCalls.length, 1);
  const ev = metaCalls[0].body.data[0];
  assert.match(metaCalls[0].url, /graph\.facebook\.com\/v21\.0\/985938324124371\/events/);
  assert.equal(ev.event_name, 'Purchase');
  assert.equal(ev.event_id, `purchase-${pending[0].id}`);
  assert.equal(ev.custom_data.value, 25000);
  assert.equal(ev.custom_data.currency, 'ARS');
  assert.equal(ev.user_data.fbc, lead.fbc);
  assert.equal(ev.user_data.fbp, 'fb.1.123.456');
  assert.equal(ev.user_data.ph.length, 1); // teléfono cifrado
  assert.equal(ev.user_data.client_user_agent, 'iPhone');
  assert.equal(metaCalls[0].body.test_event_code, 'TEST123');

  // 5) el mismo comprobante reenviado no suma otra venta
  nextReading = reading({ operation_id: 'OP-1001' });
  log = await handleKommoWebhook(deps(), accountId, kommoMsg({ id: 'm3', type: 'incoming', entity_type: 'lead', entity_id: '555', 'attachment][type': 'picture', 'attachment][link': 'https://files.kommo.test/b.jpg' }));
  assert.ok(log.some(l => l.includes('duplicate')), log.join('|'));

  // 6) el vendedor mueve el negocio a "Compró": no se duplica la venta
  log = await handleKommoWebhook(deps(), accountId, { 'leads[status][0][id]': '555', 'leads[status][0][status_id]': '77', 'leads[status][0][pipeline_id]': '1' });
  assert.ok(log.some(l => l.includes('ya está registrada')), log.join('|'));
  assert.equal((await db.query('select count(*)::int as n from sales where lead_id = $1', [lead.id])).rows[0].n, 1);
});

test('el mismo webhook de Kommo repetido no procesa dos veces la imagen', async () => {
  const code = await click('video2');
  await handleKommoWebhook(deps(), accountId, kommoMsg({ id: 'r1', type: 'incoming', text: `mi código es ${code}`, entity_type: 'lead', entity_id: '600' }));
  nextReading = reading();
  const payload = kommoMsg({ id: 'r2', type: 'incoming', entity_type: 'lead', entity_id: '600', 'attachment][type': 'picture', 'attachment][link': 'https://files.kommo.test/r.jpg' });
  await handleKommoWebhook(deps(), accountId, payload);
  const log = await handleKommoWebhook(deps(), accountId, payload);
  assert.ok(log.some(l => l.includes('already_processed')), log.join('|'));
});

test('modo automático: venta aprobada y enviada sola; casos dudosos van a revisión', async () => {
  await api('PUT', '/api/settings', { approval_mode: 'auto', recipient_keywords: ['nubecalm'] });
  const before = metaCalls.length;

  const code = await click('video3');
  await handleKommoWebhook(deps(), accountId, kommoMsg({ id: 'a1', type: 'incoming', text: `mi código es ${code}`, entity_type: 'lead', entity_id: '700' }));
  nextReading = reading({ amount: 18500.5 });
  await handleKommoWebhook(deps(), accountId, kommoMsg({ id: 'a2', type: 'incoming', entity_type: 'lead', entity_id: '700', 'attachment][type': 'picture', 'attachment][link': 'https://files.kommo.test/c.jpg' }));
  assert.equal(metaCalls.length, before + 1);
  assert.equal(metaCalls.at(-1)!.body.data[0].custom_data.value, 18500.5);

  // destinatario que no es el negocio -> revisión, no se manda
  const code2 = await click('video3');
  await handleKommoWebhook(deps(), accountId, kommoMsg({ id: 'b1', type: 'incoming', text: `mi código es ${code2}`, entity_type: 'lead', entity_id: '701' }));
  nextReading = reading({ recipient_name: 'Otra Persona', recipient_account: 'otro.alias' });
  await handleKommoWebhook(deps(), accountId, kommoMsg({ id: 'b2', type: 'incoming', entity_type: 'lead', entity_id: '701', 'attachment][type': 'picture', 'attachment][link': 'https://files.kommo.test/d.jpg' }));
  // confianza baja -> revisión
  const code3 = await click('video3');
  await handleKommoWebhook(deps(), accountId, kommoMsg({ id: 'c1', type: 'incoming', text: `mi código es ${code3}`, entity_type: 'lead', entity_id: '702' }));
  nextReading = reading({ confidence: 0.4, notes: 'Los números parecen editados.' });
  await handleKommoWebhook(deps(), accountId, kommoMsg({ id: 'c2', type: 'incoming', entity_type: 'lead', entity_id: '702', 'attachment][type': 'picture', 'attachment][link': 'https://files.kommo.test/e.jpg' }));
  assert.equal(metaCalls.length, before + 1);
  const pending = (await api('GET', '/api/sales?status=pending')).body;
  assert.ok(pending.some((s: any) => /destinatario no coincide/.test(s.review_reason)));
  assert.ok(pending.some((s: any) => /confianza baja.*editados/.test(s.review_reason)));

  // una foto que no es comprobante no crea venta
  nextReading = reading({ is_payment_receipt: false, amount: null });
  const n = (await db.query('select count(*)::int as n from sales')).rows[0].n;
  await handleKommoWebhook(deps(), accountId, kommoMsg({ id: 'd1', type: 'incoming', entity_type: 'lead', entity_id: '702', 'attachment][type': 'picture', 'attachment][link': 'https://files.kommo.test/f.jpg' }));
  assert.equal((await db.query('select count(*)::int as n from sales')).rows[0].n, n);
  await api('PUT', '/api/settings', { approval_mode: 'manual', recipient_keywords: [] });
});

test('venta por etapa de Kommo sin comprobante (con monto del negocio)', async () => {
  await api('PUT', '/api/settings', { approval_mode: 'auto' });
  const before = metaCalls.length;
  const code = await click('video4');
  await handleKommoWebhook(deps(), accountId, kommoMsg({ id: 'e1', type: 'incoming', text: `mi código es ${code}`, entity_type: 'lead', entity_id: '800' }));
  const log = await handleKommoWebhook(deps(), accountId, { 'leads[status][0][id]': '800', 'leads[status][0][status_id]': '142', 'leads[status][0][pipeline_id]': '1' });
  assert.ok(log.some(l => l.includes('venta registrada')), log.join('|'));
  assert.equal(metaCalls.length, before + 1);
  assert.equal(metaCalls.at(-1)!.body.data[0].custom_data.value, 40000);
  await api('PUT', '/api/settings', { approval_mode: 'manual' });
});

test('carga manual de comprobante desde el portal', async () => {
  const code = await click('video5');
  nextReading = reading({ amount: 9900 });
  const res = await api('POST', '/api/receipts/upload', { code, image: `data:image/jpeg;base64,${JPEG.toString('base64')}` });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'accepted');
  assert.equal((await api('POST', '/api/receipts/upload', { code: 'ZZZZZZZZ', image: JPEG.toString('base64') })).status, 400);
});

test('resumen por campaña y anuncio', async () => {
  const s = (await api('GET', '/api/summary?days=30')).body;
  assert.ok(s.totals.clicks >= 6);
  assert.ok(s.totals.sales >= 3);
  const v1 = s.byAd.find((r: any) => r.ad === 'video1');
  assert.equal(v1.sales, 1);
  assert.equal(v1.revenue, 25000);
  assert.ok(s.byLine.length === 2);
});

test('seguridad: webhook con secreto inválido, API sin sesión y cuentas aisladas', async () => {
  assert.equal((await app.inject({ method: 'POST', url: `/webhooks/kommo/${accountId}/secreto-falso`, payload: 'a=1', headers: { 'content-type': 'application/x-www-form-urlencoded' } })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: '/api/sales' })).statusCode, 401);
  // otra cuenta no ve las ventas de esta
  const other = await db.query<{ id: string }>('insert into accounts (name, public_key) values ($1, $2) returning id', ['Otro', randomToken(12)]);
  await db.query(`insert into users (account_id, email, password_hash) values ($1, 'otro@test.com', $2)`, [other.rows[0].id, hashPassword('otra-clave-segura')]);
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'otro@test.com', password: 'otra-clave-segura' } });
  const otherCookie = String(login.headers['set-cookie']).split(';')[0];
  const sales = await app.inject({ method: 'GET', url: '/api/sales', headers: { cookie: otherCookie } });
  assert.deepEqual(JSON.parse(sales.body), []);
});

test('webhook real de Kommo: responde al instante y procesa después', async () => {
  const secret = (await db.query('select webhook_secret from kommo_configs where account_id = $1', [accountId])).rows[0].webhook_secret;
  const code = await click('video6');
  const res = await app.inject({
    method: 'POST', url: `/webhooks/kommo/${accountId}/${secret}`,
    payload: new URLSearchParams({ 'message[add][0][id]': 'w1', 'message[add][0][type]': 'incoming', 'message[add][0][text]': `mi código es ${code}`, 'message[add][0][entity_type]': 'lead', 'message[add][0][entity_id]': '900' }).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  assert.equal(res.statusCode, 200);
  for (let i = 0; i < 50; i++) {
    const r = await db.query('select result from webhook_events order by id desc limit 1');
    if (r.rows[0]?.result) {
      assert.match(r.rows[0].result, new RegExp(`código ${code} vinculado`));
      return;
    }
    await new Promise(r => setTimeout(r, 20));
  }
  assert.fail('el webhook no se procesó');
});
