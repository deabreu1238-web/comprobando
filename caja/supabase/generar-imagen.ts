// Función de Supabase "generar-imagen": genera imágenes con la IA de OpenAI (ChatGPT).
// Pegá TODO este texto en Supabase -> Edge Functions -> Deploy a new function -> Via Editor,
// con el nombre exacto: generar-imagen
// La clave de OpenAI va en Edge Functions -> Secrets con el nombre OPENAI_API_KEY (nunca en este archivo).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const SIZES = ['1024x1024', '1024x1536', '1536x1024'];
const QUALITY = ['low', 'medium', 'high'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function dataUrlToBlob(d: string): Blob | null {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(d || '');
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  // Solo vos (admin) podés generar: así nadie gasta tu crédito de OpenAI.
  const auth = req.headers.get('Authorization') || '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: esAdmin, error: authErr } = await sb.rpc('es_admin');
  if (authErr || esAdmin !== true) return json({ error: 'Solo el administrador puede generar imágenes. Entrá primero a tu panel con tu usuario admin y volvé a esta página.' }, 403);

  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return json({ error: 'Falta cargar la clave OPENAI_API_KEY en los secretos de Supabase.' }, 500);
  const model = Deno.env.get('OPENAI_IMAGE_MODEL') || 'gpt-image-1';

  let body: { prompt?: string; refs?: string[]; size?: string; quality?: string; n?: number };
  try { body = await req.json(); } catch { return json({ error: 'Pedido inválido.' }, 400); }
  const prompt = String(body.prompt || '').trim().slice(0, 3000);
  if (prompt.length < 5) return json({ error: 'Describí la imagen que querés.' }, 400);
  const size = SIZES.includes(String(body.size)) ? String(body.size) : '1024x1024';
  const quality = QUALITY.includes(String(body.quality)) ? String(body.quality) : 'medium';
  const n = Math.max(1, Math.min(4, Number(body.n) || 1));
  const refs = (Array.isArray(body.refs) ? body.refs : []).slice(0, 3).map(dataUrlToBlob).filter(Boolean) as Blob[];

  let res: Response;
  if (refs.length) {
    // Con imágenes de referencia: la IA las usa como guía de estilo, colores y escena.
    const fd = new FormData();
    fd.append('model', model);
    fd.append('prompt', prompt);
    fd.append('size', size);
    fd.append('quality', quality);
    fd.append('n', String(n));
    refs.forEach((b, i) => fd.append('image[]', b, `referencia-${i + 1}.${b.type.split('/')[1]}`));
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, size, quality, n }),
    });
  }

  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = out?.error?.message || 'OpenAI no pudo generar la imagen.';
    const code = out?.error?.code || '';
    const human = code === 'moderation_blocked' || /safety|moderation|policy/i.test(msg)
      ? 'OpenAI rechazó el pedido por sus reglas de contenido. Probá describirlo de otra forma.'
      : res.status === 401 ? 'La clave de OpenAI no es válida. Revisá el secreto OPENAI_API_KEY.'
      : res.status === 429 || /quota|billing/i.test(msg) ? 'Tu cuenta de OpenAI no tiene saldo o llegó al límite. Cargá crédito en platform.openai.com.'
      : msg;
    return json({ error: human }, 502);
  }
  const images = (out.data || []).map((d: { b64_json?: string }) => d.b64_json ? 'data:image/png;base64,' + d.b64_json : null).filter(Boolean);
  return json({ images, usage: out.usage || null });
});
