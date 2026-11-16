import type { FastifyInstance } from 'fastify';
import type { Deps } from '../services/engine.js';
import { recordClick } from '../services/engine.js';
import { trackerScript } from '../landing/tracker.js';

// Límite simple por IP para el endpoint público de clics.
const hits = new Map<string, { n: number; reset: number }>();
function allowed(ip: string, max = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + windowMs });
    if (hits.size > 50_000) hits.clear();
    return true;
  }
  h.n++;
  return h.n <= max;
}

export function publicRoutes(app: FastifyInstance, deps: Deps, publicUrl: string) {
  const { db } = deps;

  app.get('/health', async () => ({ ok: true }));

  app.get<{ Params: { key: string } }>('/t/:key', async (req, reply) => {
    const key = req.params.key.replace(/\.js$/, '');
    const acc = await db.query<{ id: string; message_template: string }>(
      'select id, message_template from accounts where public_key = $1 and active',
      [key],
    );
    reply.header('content-type', 'application/javascript; charset=utf-8').header('cache-control', 'public, max-age=60');
    if (!acc.rows[0]) return reply.code(404).send('/* Clave pública inválida */');
    const a = acc.rows[0];
    const lines = await db.query<{ id: string; phone: string; weight: number }>(
      'select id, phone, weight from lines where account_id = $1 and active order by created_at',
      [a.id],
    );
    const meta = await db.query<{ pixel_id: string; inject_pixel: boolean }>(
      'select pixel_id, inject_pixel from meta_configs where account_id = $1',
      [a.id],
    );
    const m = meta.rows[0];
    return trackerScript({
      apiBase: publicUrl,
      publicKey: key,
      lines: lines.rows,
      messageTemplate: a.message_template,
      pixelId: m?.inject_pixel ? m.pixel_id : null,
    });
  });

  app.post('/api/public/click', async (req, reply) => {
    reply.header('access-control-allow-origin', '*');
    if (!allowed(req.ip)) return reply.code(429).send({ error: 'Demasiados clics' });
    let body: Record<string, unknown>;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : ((req.body as Record<string, unknown>) ?? {});
    } catch {
      return reply.code(400).send({ error: 'JSON inválido' });
    }
    const acc = await db.query<{ id: string }>('select id from accounts where public_key = $1 and active', [String(body.k ?? '')]);
    if (!acc.rows[0]) return reply.code(404).send({ error: 'Clave pública inválida' });
    const { code } = await recordClick(db, acc.rows[0].id, body as never, req.ip, (req.headers['user-agent'] as string) ?? null);
    return { code };
  });

  app.options('/api/public/click', async (_req, reply) =>
    reply.header('access-control-allow-origin', '*').header('access-control-allow-methods', 'POST').header('access-control-allow-headers', 'content-type').code(204).send(),
  );
}
