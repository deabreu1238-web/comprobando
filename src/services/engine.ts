import type { Db } from '../db.js';
import { CODE_RE, decrypt, newCode } from '../crypto.js';
import { sendPurchase } from './capi.js';
import { detectMediaType, type ReceiptAnalyzer, type ReceiptReading } from './receipts.js';

export interface Deps {
  db: Db;
  encryptionKey: string;
  metaApiVersion: string;
  analyzer: ReceiptAnalyzer;
  fetch: typeof fetch;
  log: (msg: string, extra?: Record<string, unknown>) => void;
}

export interface Account {
  id: string;
  name: string;
  public_key: string;
  currency: string;
  approval_mode: 'manual' | 'auto';
  auto_min_confidence: string;
  recipient_keywords: string[];
  message_template: string;
}

export interface Lead {
  id: string;
  account_id: string;
  code: string;
  fbc: string | null;
  fbp: string | null;
  client_ip: string | null;
  user_agent: string | null;
  landing_url: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  kommo_lead_id: string | null;
}

/** Ventana en la que una segunda señal de venta (comprobante + etapa) se considera la misma venta. */
const SAME_SALE_WINDOW = '72 hours';

export async function getAccount(db: Db, id: string): Promise<Account | null> {
  const r = await db.query<Account>('select * from accounts where id = $1 and active', [id]);
  return r.rows[0] ?? null;
}

// ---------------------------------------------------------------- clics

export interface ClickInput {
  code?: string;
  lineId?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  url?: string;
  utm?: Partial<Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term', string>>;
}

const clip = (v: unknown, n = 500) => (typeof v === 'string' && v ? v.slice(0, n) : null);

export async function recordClick(db: Db, accountId: string, input: ClickInput, ip: string | null, ua: string | null): Promise<{ code: string }> {
  // El código lo genera el navegador (así WhatsApp abre al instante); si no vino o choca, generamos otro.
  let code = input.code && new RegExp(`^${CODE_RE.source}$`).test(input.code) ? input.code : newCode();
  const line = input.lineId
    ? (await db.query<{ id: string }>('select id from lines where id = $1 and account_id = $2', [input.lineId, accountId])).rows[0]
    : undefined;
  let fbc = clip(input.fbc, 300);
  if (!fbc && input.fbclid) fbc = `fb.1.${Date.now()}.${clip(input.fbclid, 250)}`;
  const u = input.utm ?? {};
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await db.query(
        `insert into leads (account_id, code, line_id, fbclid, fbc, fbp, client_ip, user_agent, landing_url,
           utm_source, utm_medium, utm_campaign, utm_content, utm_term)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [accountId, code, line?.id ?? null, clip(input.fbclid, 300), fbc, clip(input.fbp, 300), clip(ip, 64), clip(ua, 400),
          clip(input.url, 1000), clip(u.utm_source, 200), clip(u.utm_medium, 200), clip(u.utm_campaign, 200), clip(u.utm_content, 200), clip(u.utm_term, 200)],
      );
      return { code };
    } catch (e: unknown) {
      if ((e as { code?: string }).code === '23505') {
        // mismo código ya registrado: si es un reenvío del mismo clic, listo
        const existing = await db.query('select 1 from leads where account_id = $1 and code = $2', [accountId, code]);
        if (existing.rowCount && attempt === 0 && input.code === code) return { code };
        code = newCode();
        continue;
      }
      throw e;
    }
  }
  throw new Error('No se pudo generar un código único');
}

// ---------------------------------------------------------------- vinculación de chats

/** Busca un código en el texto del mensaje y vincula el lead con la conversación de Kommo. */
export async function linkFromMessage(
  db: Db,
  accountId: string,
  text: string,
  ref: { kommoLeadId?: number; kommoContactId?: number; customerName?: string; customerPhone?: string },
): Promise<Lead | null> {
  const candidates = [...text.toUpperCase().matchAll(new RegExp(CODE_RE.source, 'g'))].map(m => m[0]);
  for (const code of candidates) {
    const r = await db.query<Lead>(
      `update leads set status = case when status = 'clicked' then 'contacted' else status end,
         first_message_at = coalesce(first_message_at, now()),
         kommo_lead_id = coalesce($3, kommo_lead_id), kommo_contact_id = coalesce($4, kommo_contact_id),
         customer_name = coalesce(customer_name, $5), customer_phone = coalesce(customer_phone, $6)
       where account_id = $1 and code = $2 returning *`,
      [accountId, code, ref.kommoLeadId ?? null, ref.kommoContactId ?? null, ref.customerName ?? null, ref.customerPhone ?? null],
    );
    if (r.rows[0]) return r.rows[0];
  }
  return null;
}

export async function findLeadByKommo(db: Db, accountId: string, kommoLeadId: number): Promise<Lead | null> {
  const r = await db.query<Lead>(
    'select * from leads where account_id = $1 and kommo_lead_id = $2 order by created_at desc limit 1',
    [accountId, kommoLeadId],
  );
  return r.rows[0] ?? null;
}

// ---------------------------------------------------------------- comprobantes

export interface ReceiptInput {
  leadId: string | null;
  source: 'kommo' | 'upload';
  sourceRef: string | null;
  image: Buffer;
  contentType?: string | null;
}

export interface ReceiptOutcome {
  receiptId: string | null;
  status: 'not_receipt' | 'review' | 'accepted' | 'duplicate' | 'error' | 'already_processed';
  saleId?: string;
}

function recipientOk(reading: ReceiptReading, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const hay = `${reading.recipient_name ?? ''} ${reading.recipient_account ?? ''}`.toLowerCase();
  return keywords.some(k => k.trim() && hay.includes(k.trim().toLowerCase()));
}

export async function processReceipt(deps: Deps, account: Account, input: ReceiptInput): Promise<ReceiptOutcome> {
  const { db } = deps;
  const mediaType = detectMediaType(input.image, input.contentType);
  const ins = await db.query<{ id: string }>(
    `insert into receipts (account_id, lead_id, source, source_ref, media_type, image)
     values ($1,$2,$3,$4,$5,$6) on conflict (account_id, source, source_ref) do nothing returning id`,
    [account.id, input.leadId, input.source, input.sourceRef, mediaType, input.image],
  );
  if (!ins.rows[0]) return { receiptId: null, status: 'already_processed' };
  const receiptId = ins.rows[0].id;

  if (!mediaType) {
    await db.query(`update receipts set status = 'not_receipt', error = 'Formato de imagen no soportado' where id = $1`, [receiptId]);
    return { receiptId, status: 'not_receipt' };
  }

  let reading: ReceiptReading | null;
  try {
    reading = await deps.analyzer(input.image, mediaType);
  } catch (e) {
    deps.log('Error leyendo comprobante', { receiptId, error: String(e) });
    await db.query(`update receipts set status = 'error', error = $2 where id = $1`, [receiptId, String(e).slice(0, 500)]);
    return { receiptId, status: 'error' };
  }

  if (!reading) {
    // el modelo no pudo leerla: que la vea una persona
    await db.query(`update receipts set status = 'review', error = 'La IA no pudo leer la imagen' where id = $1`, [receiptId]);
    const saleId = await upsertSaleFromReceipt(deps, account, receiptId, input.leadId, 0, account.currency, 'La IA no pudo leer la imagen; revisá el monto.');
    return { receiptId, status: 'review', saleId };
  }

  if (!reading.is_payment_receipt) {
    await db.query(`update receipts set status = 'not_receipt', is_receipt = false, ai_result = $2, confidence = $3 where id = $1`, [
      receiptId, JSON.stringify(reading), reading.confidence,
    ]);
    return { receiptId, status: 'not_receipt' };
  }

  const opId = reading.operation_id?.replace(/\s+/g, '') || null;
  const amount = reading.amount && reading.amount > 0 ? reading.amount : 0;
  const currency = (reading.currency || account.currency).toUpperCase().slice(0, 3);
  const minConf = Number(account.auto_min_confidence);
  const problems: string[] = [];
  if (!amount) problems.push('no se pudo leer el monto');
  if (reading.confidence < minConf) problems.push(`confianza baja (${Math.round(reading.confidence * 100)}%)`);
  if (!recipientOk(reading, account.recipient_keywords)) problems.push('el destinatario no coincide con tus datos');
  if (!input.leadId) problems.push('el chat no tiene código de seguimiento');

  try {
    await db.query(
      `update receipts set status = $2, is_receipt = true, amount = $3, currency = $4, operation_id = $5, bank = $6,
         receipt_date = $7, payer_name = $8, recipient_name = $9, confidence = $10, ai_result = $11 where id = $1`,
      [receiptId, problems.length ? 'review' : 'accepted', amount || null, currency, opId, reading.bank_or_wallet,
        reading.date, reading.payer_name, reading.recipient_name, reading.confidence, JSON.stringify(reading)],
    );
  } catch (e: unknown) {
    if ((e as { code?: string }).code === '23505') {
      // mismo número de operación ya cargado en esta cuenta: es el mismo pago reenviado
      await db.query(
        `update receipts set status = 'duplicate', is_receipt = true, amount = $2, currency = $3, operation_id = $4, ai_result = $5 where id = $1`,
        [receiptId, amount || null, currency, opId, JSON.stringify(reading)],
      );
      return { receiptId, status: 'duplicate' };
    }
    throw e;
  }

  const notes = reading.notes && !/^sin observaciones/i.test(reading.notes) ? [reading.notes] : [];
  const saleId = await upsertSaleFromReceipt(deps, account, receiptId, input.leadId, amount, currency, problems.length ? [...problems, ...notes].join('; ') : null);
  return { receiptId, status: problems.length ? 'review' : 'accepted', saleId };
}

async function upsertSaleFromReceipt(
  deps: Deps, account: Account, receiptId: string, leadId: string | null, amount: number, currency: string, reviewReason: string | null,
): Promise<string> {
  const { db } = deps;
  // Si la venta ya se registró por la etapa de Kommo hace poco, se le suma el comprobante en vez de crear otra.
  if (leadId) {
    const prev = await db.query<{ id: string; amount: string }>(
      `select id, amount from sales where lead_id = $1 and source = 'kommo_stage' and receipt_id is null
         and status <> 'rejected' and created_at > now() - interval '${SAME_SALE_WINDOW}' order by created_at desc limit 1`,
      [leadId],
    );
    if (prev.rows[0]) {
      await db.query(`update sales set receipt_id = $2, amount = case when amount = 0 then $3 else amount end where id = $1`, [
        prev.rows[0].id, receiptId, amount,
      ]);
      return prev.rows[0].id;
    }
  }
  const auto = account.approval_mode === 'auto' && !reviewReason;
  const r = await db.query<{ id: string }>(
    `insert into sales (account_id, lead_id, receipt_id, source, amount, currency, status, review_reason, approved_at)
     values ($1,$2,$3,'receipt',$4,$5,$6,$7,$8) returning id`,
    [account.id, leadId, receiptId, amount, currency, auto ? 'approved' : 'pending', reviewReason, auto ? new Date() : null],
  );
  const saleId = r.rows[0].id;
  if (leadId) await db.query(`update leads set status = 'won' where id = $1`, [leadId]);
  if (auto) await sendSaleToMeta(deps, saleId);
  return saleId;
}

// ---------------------------------------------------------------- etapa ganada en Kommo

export async function recordWonStage(
  deps: Deps, account: Account, kommoLeadId: number, price: number,
): Promise<{ saleId: string | null; skipped?: string }> {
  const { db } = deps;
  const lead = await findLeadByKommo(db, account.id, kommoLeadId);
  if (lead) {
    const recent = await db.query(
      `select 1 from sales where lead_id = $1 and status <> 'rejected' and created_at > now() - interval '${SAME_SALE_WINDOW}'`,
      [lead.id],
    );
    if (recent.rowCount) return { saleId: null, skipped: 'La venta de este lead ya está registrada' };
  }
  const reasons: string[] = [];
  if (!lead) reasons.push('el negocio de Kommo no tiene código de seguimiento');
  if (!price) reasons.push('el negocio de Kommo no tiene monto cargado');
  // Una etapa movida a mano por un vendedor es una señal confiable: se aprueba sola si tiene monto y lead.
  const auto = account.approval_mode === 'auto' && reasons.length === 0;
  const r = await db.query<{ id: string }>(
    `insert into sales (account_id, lead_id, source, amount, currency, status, review_reason, approved_at)
     values ($1,$2,'kommo_stage',$3,$4,$5,$6,$7) returning id`,
    [account.id, lead?.id ?? null, price || 0, account.currency, auto ? 'approved' : 'pending', reasons.join('; ') || null, auto ? new Date() : null],
  );
  if (lead) await db.query(`update leads set status = 'won' where id = $1`, [lead.id]);
  if (auto) await sendSaleToMeta(deps, r.rows[0].id);
  return { saleId: r.rows[0].id };
}

// ---------------------------------------------------------------- aprobación y envío a Meta

export async function approveSale(deps: Deps, accountId: string, saleId: string, amount?: number): Promise<void> {
  const r = await deps.db.query(
    `update sales set status = 'approved', approved_at = now(), amount = coalesce($3, amount)
     where id = $1 and account_id = $2 and status = 'pending'`,
    [saleId, accountId, amount ?? null],
  );
  if (!r.rowCount) throw new Error('La venta no existe o ya fue revisada');
  await deps.db.query(
    `update receipts set status = 'accepted' where id = (select receipt_id from sales where id = $1) and status = 'review'`,
    [saleId],
  );
  await sendSaleToMeta(deps, saleId);
}

export async function rejectSale(db: Db, accountId: string, saleId: string): Promise<void> {
  const r = await db.query(
    `update sales set status = 'rejected' where id = $1 and account_id = $2 and status = 'pending'`,
    [saleId, accountId],
  );
  if (!r.rowCount) throw new Error('La venta no existe o ya fue revisada');
}

export async function sendSaleToMeta(deps: Deps, saleId: string): Promise<'sent' | 'error' | 'skipped'> {
  const { db } = deps;
  const r = await db.query<{
    id: string; account_id: string; amount: string; currency: string; status: string; capi_status: string; created_at: Date;
    pixel_id: string | null; capi_token_enc: string | null; test_event_code: string | null; lead_id: string | null;
  } & Partial<Omit<Lead, 'id'>>>(
    `select s.id, s.account_id, s.amount, s.currency, s.status, s.capi_status, s.created_at,
            m.pixel_id, m.capi_token_enc, m.test_event_code,
            l.code, l.fbc, l.fbp, l.client_ip, l.user_agent, l.landing_url, l.customer_phone, l.customer_name, l.id as lead_id
     from sales s left join leads l on l.id = s.lead_id left join meta_configs m on m.account_id = s.account_id
     where s.id = $1`,
    [saleId],
  );
  const s = r.rows[0];
  if (!s || s.status !== 'approved' || s.capi_status === 'sent') return 'skipped';
  const skip = async (why: string) => {
    await db.query(`update sales set capi_status = 'skipped', capi_response = $2 where id = $1`, [saleId, JSON.stringify({ motivo: why })]);
    return 'skipped' as const;
  };
  if (!s.pixel_id || !s.capi_token_enc) return skip('Falta configurar el píxel o el token de Meta');
  if (!s.lead_id) return skip('La venta no tiene un clic de anuncio asociado');
  if (!Number(s.amount)) return skip('La venta no tiene monto');

  const eventId = `purchase-${saleId}`;
  try {
    const res = await sendPurchase(
      {
        pixelId: s.pixel_id,
        accessToken: decrypt(s.capi_token_enc, deps.encryptionKey),
        testEventCode: s.test_event_code,
        apiVersion: deps.metaApiVersion,
        eventId,
        eventTime: new Date(),
        value: Number(s.amount),
        currency: s.currency,
        lead: s,
      },
      deps.fetch,
    );
    await db.query(
      `update sales set capi_status = $2, capi_event_id = $3, capi_response = $4, sent_at = case when $2 = 'sent' then now() else sent_at end where id = $1`,
      [saleId, res.ok ? 'sent' : 'error', eventId, JSON.stringify(res.body)],
    );
    if (!res.ok) deps.log('Meta rechazó el evento', { saleId, status: res.status, body: res.body });
    return res.ok ? 'sent' : 'error';
  } catch (e) {
    await db.query(`update sales set capi_status = 'error', capi_response = $2 where id = $1`, [saleId, JSON.stringify({ error: String(e) })]);
    deps.log('Error enviando a Meta', { saleId, error: String(e) });
    return 'error';
  }
}
