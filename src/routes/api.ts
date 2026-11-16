import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { encrypt, hashPassword, randomToken } from '../crypto.js';
import { login, logout, requireUser, SESSION_COOKIE, sessionCookie } from '../auth.js';
import {
  approveSale, type Deps, getAccount, processReceipt, rejectSale, sendSaleToMeta,
} from '../services/engine.js';

function bad(reply: FastifyReply, msg: string, code = 400) {
  return reply.code(code).send({ error: msg });
}
function parse<T>(schema: z.ZodType<T>, data: unknown, reply: FastifyReply): T | null {
  const r = schema.safeParse(data);
  if (!r.success) {
    bad(reply, r.error.issues.map(i => `${i.path.join('.') || 'dato'}: ${i.message}`).join('; '));
    return null;
  }
  return r.data;
}
const acc = (req: FastifyRequest) => req.user!.account_id!;

export function apiRoutes(app: FastifyInstance, deps: Deps, opts: { publicUrl: string; cookieSecure: boolean }) {
  const { db } = deps;
  const auth = requireUser(db);

  // ------------------------------------------------------------ sesión
  app.post('/api/auth/login', async (req, reply) => {
    const body = parse(z.object({ email: z.string().email(), password: z.string().min(1) }), req.body, reply);
    if (!body) return;
    const r = await login(db, body.email, body.password);
    if (!r) return bad(reply, 'Email o contraseña incorrectos', 401);
    reply.setCookie(SESSION_COOKIE, r.token, sessionCookie(opts.cookieSecure));
    return { user: r.user };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await logout(db, req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/me', { preHandler: auth }, async req => {
    const account = req.user!.account_id ? await getAccount(db, req.user!.account_id) : null;
    return { user: req.user, account };
  });

  // Todo lo que sigue requiere usuario con cuenta.
  app.register(async scoped => {
    scoped.addHook('preHandler', auth);
    scoped.addHook('preHandler', async (req, reply) => {
      if (!req.user!.account_id) return bad(reply, 'Tu usuario no pertenece a ninguna cuenta', 403);
    });

    // ---------------------------------------------------------- resumen
    scoped.get<{ Querystring: { days?: string } }>('/api/summary', async req => {
      const days = Math.min(365, Math.max(1, Number(req.query.days ?? 30) || 30));
      const totals = await db.query(
        `select
           (select count(*) from leads where account_id = $1 and created_at > now() - make_interval(days => $2))::int as clicks,
           (select count(*) from leads where account_id = $1 and first_message_at is not null and created_at > now() - make_interval(days => $2))::int as chats,
           (select count(*) from sales where account_id = $1 and status = 'approved' and created_at > now() - make_interval(days => $2))::int as sales,
           (select coalesce(sum(amount), 0) from sales where account_id = $1 and status = 'approved' and created_at > now() - make_interval(days => $2))::float as revenue,
           (select count(*) from sales where account_id = $1 and status = 'pending')::int as pending,
           (select count(*) from sales where account_id = $1 and capi_status = 'sent' and created_at > now() - make_interval(days => $2))::int as sent_to_meta`,
        [acc(req), days],
      );
      const byAd = await db.query(
        `select coalesce(l.utm_campaign, '(sin campaña)') as campaign, coalesce(l.utm_content, '(sin anuncio)') as ad,
                count(distinct l.id)::int as clicks,
                count(distinct l.id) filter (where l.first_message_at is not null)::int as chats,
                count(s.id) filter (where s.status = 'approved')::int as sales,
                coalesce(sum(s.amount) filter (where s.status = 'approved'), 0)::float as revenue
         from leads l left join sales s on s.lead_id = l.id
         where l.account_id = $1 and l.created_at > now() - make_interval(days => $2)
         group by 1, 2 order by revenue desc, clicks desc limit 50`,
        [acc(req), days],
      );
      const byLine = await db.query(
        `select ln.label, ln.phone, count(l.id)::int as clicks,
                count(l.id) filter (where l.first_message_at is not null)::int as chats
         from lines ln left join leads l on l.line_id = ln.id and l.created_at > now() - make_interval(days => $2)
         where ln.account_id = $1 group by ln.id order by clicks desc`,
        [acc(req), days],
      );
      return { days, totals: totals.rows[0], byAd: byAd.rows, byLine: byLine.rows };
    });

    // ---------------------------------------------------------- líneas
    const LineIn = z.object({
      label: z.string().trim().min(1).max(60),
      phone: z.string().transform(s => s.replace(/\D/g, '')).pipe(z.string().min(8, 'número demasiado corto').max(15)),
      weight: z.coerce.number().int().min(1).max(100).default(1),
      active: z.boolean().default(true),
    });
    scoped.get('/api/lines', async req => (await db.query('select * from lines where account_id = $1 order by created_at', [acc(req)])).rows);
    scoped.post('/api/lines', async (req, reply) => {
      const b = parse(LineIn, req.body, reply);
      if (!b) return;
      try {
        const r = await db.query('insert into lines (account_id, label, phone, weight, active) values ($1,$2,$3,$4,$5) returning *', [
          acc(req), b.label, b.phone, b.weight, b.active,
        ]);
        return r.rows[0];
      } catch (e: unknown) {
        if ((e as { code?: string }).code === '23505') return bad(reply, 'Ese número ya está cargado');
        throw e;
      }
    });
    scoped.patch<{ Params: { id: string } }>('/api/lines/:id', async (req, reply) => {
      const b = parse(LineIn.partial(), req.body, reply);
      if (!b) return;
      const r = await db.query(
        `update lines set label = coalesce($3, label), phone = coalesce($4, phone), weight = coalesce($5, weight), active = coalesce($6, active)
         where id = $1 and account_id = $2 returning *`,
        [req.params.id, acc(req), b.label ?? null, b.phone ?? null, b.weight ?? null, b.active ?? null],
      );
      return r.rows[0] ?? bad(reply, 'Línea inexistente', 404);
    });
    scoped.delete<{ Params: { id: string } }>('/api/lines/:id', async req => {
      await db.query('delete from lines where id = $1 and account_id = $2', [req.params.id, acc(req)]);
      return { ok: true };
    });

    // ---------------------------------------------------------- leads y ventas
    scoped.get<{ Querystring: { q?: string } }>('/api/leads', async req => {
      const q = (req.query.q ?? '').trim().toUpperCase();
      const r = await db.query(
        `select l.id, l.code, l.status, l.created_at, l.first_message_at, l.utm_campaign, l.utm_content, l.customer_name,
                l.kommo_lead_id, (l.fbc is not null) as from_ad, ln.label as line
         from leads l left join lines ln on ln.id = l.line_id
         where l.account_id = $1 and ($2 = '' or l.code = $2) order by l.created_at desc limit 200`,
        [acc(req), q],
      );
      return r.rows;
    });

    scoped.get<{ Querystring: { status?: string } }>('/api/sales', async req => {
      const st = ['pending', 'approved', 'rejected'].includes(req.query.status ?? '') ? req.query.status! : null;
      const r = await db.query(
        `select s.id, s.source, s.amount::float, s.currency, s.status, s.review_reason, s.capi_status, s.capi_response, s.created_at,
                s.receipt_id, r.bank, r.operation_id, r.payer_name, r.recipient_name, r.confidence::float, r.receipt_date,
                l.code, l.utm_campaign, l.utm_content, l.customer_name
         from sales s left join receipts r on r.id = s.receipt_id left join leads l on l.id = s.lead_id
         where s.account_id = $1 and ($2::text is null or s.status = $2) order by s.created_at desc limit 200`,
        [acc(req), st],
      );
      return r.rows;
    });

    scoped.get<{ Params: { id: string } }>('/api/receipts/:id/image', async (req, reply) => {
      const r = await db.query<{ image: Buffer; media_type: string | null }>(
        'select image, media_type from receipts where id = $1 and account_id = $2',
        [req.params.id, acc(req)],
      );
      const row = r.rows[0];
      if (!row?.image) return bad(reply, 'Imagen inexistente', 404);
      return reply.header('content-type', row.media_type ?? 'application/octet-stream').header('cache-control', 'private, max-age=3600').send(row.image);
    });

    scoped.post<{ Params: { id: string } }>('/api/sales/:id/approve', async (req, reply) => {
      const b = parse(z.object({ amount: z.coerce.number().positive().optional() }), req.body ?? {}, reply);
      if (!b) return;
      try {
        await approveSale(deps, acc(req), req.params.id, b.amount);
      } catch (e) {
        return bad(reply, (e as Error).message);
      }
      return (await db.query('select id, status, capi_status, capi_response from sales where id = $1', [req.params.id])).rows[0];
    });
    scoped.post<{ Params: { id: string } }>('/api/sales/:id/reject', async (req, reply) => {
      try {
        await rejectSale(db, acc(req), req.params.id);
      } catch (e) {
        return bad(reply, (e as Error).message);
      }
      return { ok: true };
    });
    scoped.post<{ Params: { id: string } }>('/api/sales/:id/resend', async (req, reply) => {
      const own = await db.query(`select 1 from sales where id = $1 and account_id = $2 and status = 'approved'`, [req.params.id, acc(req)]);
      if (!own.rowCount) return bad(reply, 'Solo se pueden reenviar ventas aprobadas', 404);
      await db.query(`update sales set capi_status = 'not_sent' where id = $1 and capi_status in ('error', 'skipped')`, [req.params.id]);
      return { capi_status: await sendSaleToMeta(deps, req.params.id) };
    });

    // Carga manual: para negocios que todavía no usan Kommo. Se indica el código del chat y la imagen.
    scoped.post('/api/receipts/upload', async (req, reply) => {
      const b = parse(z.object({ code: z.string().trim().toUpperCase().optional(), image: z.string().min(100) }), req.body, reply);
      if (!b) return;
      const account = await getAccount(db, acc(req));
      if (!account) return bad(reply, 'Cuenta inexistente', 404);
      let leadId: string | null = null;
      if (b.code) {
        const l = await db.query<{ id: string }>('select id from leads where account_id = $1 and code = $2', [account.id, b.code]);
        if (!l.rows[0]) return bad(reply, `No existe un clic con el código ${b.code}`);
        leadId = l.rows[0].id;
        await db.query(`update leads set first_message_at = coalesce(first_message_at, now()) where id = $1`, [leadId]);
      }
      const m = b.image.match(/^data:([^;]+);base64,(.*)$/);
      const image = Buffer.from(m ? m[2] : b.image, 'base64');
      if (image.length > 10 * 1024 * 1024) return bad(reply, 'La imagen pesa más de 10 MB');
      return processReceipt(deps, account, { leadId, source: 'upload', sourceRef: randomToken(9), image, contentType: m?.[1] });
    });

    // ---------------------------------------------------------- configuración
    scoped.get('/api/settings', async req => getAccount(db, acc(req)));
    scoped.put('/api/settings', async (req, reply) => {
      const b = parse(
        z.object({
          name: z.string().trim().min(1).max(80).optional(),
          currency: z.string().trim().length(3).toUpperCase().optional(),
          approval_mode: z.enum(['manual', 'auto']).optional(),
          auto_min_confidence: z.coerce.number().min(0.5).max(1).optional(),
          recipient_keywords: z.array(z.string().trim().min(2).max(60)).max(20).optional(),
          message_template: z.string().trim().min(3).max(200).optional(),
        }),
        req.body,
        reply,
      );
      if (!b) return;
      const r = await db.query(
        `update accounts set name = coalesce($2, name), currency = coalesce($3, currency), approval_mode = coalesce($4, approval_mode),
           auto_min_confidence = coalesce($5, auto_min_confidence), recipient_keywords = coalesce($6::text[], recipient_keywords),
           message_template = coalesce($7, message_template) where id = $1 returning *`,
        [acc(req), b.name ?? null, b.currency ?? null, b.approval_mode ?? null, b.auto_min_confidence ?? null, b.recipient_keywords ?? null, b.message_template ?? null],
      );
      return r.rows[0];
    });

    scoped.get('/api/integrations', async req => {
      const meta = await db.query('select pixel_id, test_event_code, inject_pixel, (capi_token_enc is not null) as has_token from meta_configs where account_id = $1', [acc(req)]);
      const kommo = await db.query<{ base_url: string; webhook_secret: string; won_keywords: string[] }>(
        'select base_url, webhook_secret, won_keywords from kommo_configs where account_id = $1',
        [acc(req)],
      );
      const k = kommo.rows[0];
      const account = await getAccount(db, acc(req));
      const recent = await db.query(
        `select created_at, result from webhook_events where account_id = $1 order by id desc limit 10`,
        [acc(req)],
      );
      return {
        meta: meta.rows[0] ?? null,
        kommo: k ? { base_url: k.base_url, won_keywords: k.won_keywords, webhook_url: `${opts.publicUrl}/webhooks/kommo/${acc(req)}/${k.webhook_secret}` } : null,
        kommoEvents: recent.rows,
        landing: account
          ? {
              script_url: `${opts.publicUrl}/t/${account.public_key}.js`,
              snippet: `<button onclick="openRandomLink()">Escribinos por WhatsApp</button>\n<script src="${opts.publicUrl}/t/${account.public_key}.js"></script>`,
            }
          : null,
      };
    });

    scoped.put('/api/integrations/meta', async (req, reply) => {
      const b = parse(
        z.object({
          pixel_id: z.string().trim().regex(/^\d{10,20}$/, 'el identificador del píxel son solo números'),
          capi_token: z.string().trim().min(20).optional(),
          test_event_code: z.string().trim().max(40).nullable().optional(),
          inject_pixel: z.boolean().default(true),
        }),
        req.body,
        reply,
      );
      if (!b) return;
      const tokenEnc = b.capi_token ? encrypt(b.capi_token, deps.encryptionKey) : null;
      await db.query(
        `insert into meta_configs (account_id, pixel_id, capi_token_enc, test_event_code, inject_pixel) values ($1,$2,$3,$4,$5)
         on conflict (account_id) do update set pixel_id = $2, capi_token_enc = coalesce($3, meta_configs.capi_token_enc),
           test_event_code = $4, inject_pixel = $5, updated_at = now()`,
        [acc(req), b.pixel_id, tokenEnc, b.test_event_code || null, b.inject_pixel],
      );
      return { ok: true };
    });

    scoped.put('/api/integrations/kommo', async (req, reply) => {
      const b = parse(
        z.object({
          base_url: z.string().trim().url().refine(u => /^https:\/\/[a-z0-9-]+\.(kommo|amocrm)\.(com|ru)\/?$/i.test(u), 'tiene que ser la dirección de tu cuenta, ej. https://tuempresa.kommo.com'),
          token: z.string().trim().min(20).optional(),
          won_keywords: z.array(z.string().trim().min(2)).max(30).optional(),
        }),
        req.body,
        reply,
      );
      if (!b) return;
      const existing = await db.query('select 1 from kommo_configs where account_id = $1', [acc(req)]);
      if (!existing.rowCount && !b.token) return bad(reply, 'Falta el token de larga duración de Kommo');
      await db.query(
        `insert into kommo_configs (account_id, base_url, token_enc, webhook_secret, won_keywords)
         values ($1, $2, $3, $4, coalesce($5::text[], '{ganado,compró,compro,venta,vendido,won,cerrado,aprobado,pagado}'::text[]))
         on conflict (account_id) do update set base_url = $2, token_enc = coalesce($3, kommo_configs.token_enc),
           won_keywords = coalesce($5::text[], kommo_configs.won_keywords), pipelines_cache = null, updated_at = now()`,
        [acc(req), b.base_url.replace(/\/$/, ''), b.token ? encrypt(b.token, deps.encryptionKey) : null, randomToken(24), b.won_keywords ?? null],
      );
      return { ok: true };
    });
  });

  // ------------------------------------------------------------ administración (dueño del SaaS)
  app.register(async admin => {
    admin.addHook('preHandler', auth);
    admin.addHook('preHandler', async (req, reply) => {
      if (!req.user!.is_superadmin) return bad(reply, 'Solo para administradores', 403);
    });
    admin.get('/api/admin/accounts', async () =>
      (await db.query(
        `select a.id, a.name, a.active, a.created_at, (select email from users u where u.account_id = a.id and u.role = 'owner' limit 1) as owner,
                (select count(*) from leads l where l.account_id = a.id and l.created_at > now() - interval '30 days')::int as clicks_30d,
                (select count(*) from sales s where s.account_id = a.id and s.status = 'approved' and s.created_at > now() - interval '30 days')::int as sales_30d
         from accounts a order by a.created_at desc`,
      )).rows,
    );
    admin.post('/api/admin/accounts', async (req, reply) => {
      const b = parse(
        z.object({ name: z.string().trim().min(2).max(80), owner_email: z.string().email(), owner_password: z.string().min(10, 'mínimo 10 caracteres') }),
        req.body,
        reply,
      );
      if (!b) return;
      const client = await db.connect();
      try {
        await client.query('begin');
        const a = await client.query<{ id: string }>('insert into accounts (name, public_key) values ($1, $2) returning id', [b.name, randomToken(12)]);
        await client.query(`insert into users (account_id, email, password_hash, role) values ($1, lower($2), $3, 'owner')`, [
          a.rows[0].id, b.owner_email, hashPassword(b.owner_password),
        ]);
        await client.query('commit');
        return { id: a.rows[0].id };
      } catch (e: unknown) {
        await client.query('rollback');
        if ((e as { code?: string }).code === '23505') return bad(reply, 'Ese email ya tiene usuario');
        throw e;
      } finally {
        client.release();
      }
    });
    admin.patch<{ Params: { id: string } }>('/api/admin/accounts/:id', async (req, reply) => {
      const b = parse(z.object({ active: z.boolean() }), req.body, reply);
      if (!b) return;
      await db.query('update accounts set active = $2 where id = $1', [req.params.id, b.active]);
      return { ok: true };
    });
  });
}
