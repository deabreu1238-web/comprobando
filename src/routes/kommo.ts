import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { decrypt } from '../crypto.js';
import {
  type Deps, findLeadByKommo, getAccount, linkFromMessage, processReceipt, recordWonStage,
} from '../services/engine.js';
import { isWonStatus, KommoClient, type KommoPipelineStatus, parseWebhook } from '../services/kommo.js';

interface KommoCfg {
  base_url: string;
  token_enc: string;
  webhook_secret: string;
  won_keywords: string[];
  pipelines_cache: KommoPipelineStatus[] | null;
  pipelines_cached_at: Date | null;
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)(\?|$)/i;

export async function handleKommoWebhook(deps: Deps, accountId: string, flat: Record<string, unknown>): Promise<string[]> {
  const { db } = deps;
  const account = await getAccount(db, accountId);
  const cfgRow = await db.query<KommoCfg>('select * from kommo_configs where account_id = $1', [accountId]);
  const cfg = cfgRow.rows[0];
  if (!account || !cfg) return ['cuenta o integración inexistente'];
  const kommo = new KommoClient(cfg.base_url, decrypt(cfg.token_enc, deps.encryptionKey), deps.fetch);
  const { messages, statusChanges } = parseWebhook(flat);
  const log: string[] = [];

  for (const m of messages) {
    if (!m.incoming) continue;
    let lead = m.text ? await linkFromMessage(db, accountId, m.text, { kommoLeadId: m.leadId, kommoContactId: m.contactId }) : null;
    if (lead) {
      log.push(`código ${lead.code} vinculado al negocio ${m.leadId ?? '?'}`);
      if (m.contactId && !lead.customer_phone) {
        try {
          const c = await kommo.contact(m.contactId);
          await db.query('update leads set customer_phone = coalesce(customer_phone, $2), customer_name = coalesce(customer_name, $3) where id = $1', [
            lead.id, c.phone ?? null, c.name ?? null,
          ]);
        } catch (e) {
          deps.log('No se pudo leer el contacto de Kommo', { error: String(e) });
        }
      }
    } else if (m.leadId) {
      lead = await findLeadByKommo(db, accountId, m.leadId);
    }
    const att = m.attachment;
    const looksImage = att && (/(picture|image|photo)/i.test(att.type ?? '') || IMAGE_EXT.test(att.fileName ?? '') || IMAGE_EXT.test(att.link));
    if (att && looksImage) {
      try {
        const file = await kommo.download(att.link);
        const out = await processReceipt(deps, account, {
          leadId: lead?.id ?? null,
          source: 'kommo',
          sourceRef: m.id ?? att.link,
          image: file.data,
          contentType: file.contentType,
        });
        log.push(`imagen procesada: ${out.status}`);
      } catch (e) {
        deps.log('No se pudo procesar el adjunto de Kommo', { error: String(e) });
        log.push(`error con el adjunto: ${String(e)}`);
      }
    }
  }

  if (statusChanges.length) {
    let statuses = cfg.pipelines_cache;
    const stale = !cfg.pipelines_cached_at || Date.now() - new Date(cfg.pipelines_cached_at).getTime() > 3600_000;
    if (!statuses || stale) {
      try {
        statuses = await kommo.statuses();
        await db.query('update kommo_configs set pipelines_cache = $2, pipelines_cached_at = now() where account_id = $1', [
          accountId, JSON.stringify(statuses),
        ]);
      } catch (e) {
        deps.log('No se pudieron leer los embudos de Kommo', { error: String(e) });
        statuses = statuses ?? [];
      }
    }
    for (const ch of statusChanges) {
      const name = statuses.find(st => st.id === ch.statusId)?.name;
      if (!isWonStatus(ch.statusId, name, cfg.won_keywords)) continue;
      let price = ch.price;
      if (price === undefined) {
        try {
          price = (await kommo.lead(ch.leadId)).price;
        } catch {
          price = 0;
        }
      }
      const out = await recordWonStage(deps, account, ch.leadId, price ?? 0);
      log.push(out.saleId ? `venta registrada por etapa "${name ?? ch.statusId}"` : `etapa ganada ignorada: ${out.skipped}`);
    }
  }
  return log;
}

export function kommoRoutes(app: FastifyInstance, deps: Deps) {
  app.post<{ Params: { accountId: string; secret: string } }>('/webhooks/kommo/:accountId/:secret', async (req, reply) => {
    const { accountId, secret } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(accountId)) return reply.code(404).send();
    const r = await deps.db.query<{ webhook_secret: string }>('select webhook_secret from kommo_configs where account_id = $1', [accountId]);
    const expected = r.rows[0]?.webhook_secret;
    if (!expected || expected.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(secret))) {
      return reply.code(404).send();
    }
    const flat = (typeof req.body === 'object' && req.body ? req.body : {}) as Record<string, unknown>;
    const ev = await deps.db.query<{ id: string }>(
      `insert into webhook_events (account_id, provider, payload) values ($1, 'kommo', $2) returning id`,
      [accountId, JSON.stringify(flat)],
    );
    // Kommo espera respuesta rápida: procesamos después de contestar.
    setImmediate(() => {
      handleKommoWebhook(deps, accountId, flat)
        .then(log => deps.db.query('update webhook_events set result = $2 where id = $1', [ev.rows[0].id, log.join(' | ') || 'sin acciones']))
        .catch(e => {
          deps.log('Error procesando webhook de Kommo', { error: String(e) });
          return deps.db.query('update webhook_events set result = $2 where id = $1', [ev.rows[0].id, `error: ${String(e)}`]);
        });
    });
    return reply.code(200).send({ ok: true });
  });
}
