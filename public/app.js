// Portal de Comprobado: una sola página, sin dependencias.
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var view = $('#view');
  var state = { me: null };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function money(n, cur) {
    try { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur || 'ARS', maximumFractionDigits: 2 }).format(n || 0); }
    catch (e) { return (cur || '') + ' ' + Number(n || 0).toLocaleString('es-AR'); }
  }
  function when(d) { return d ? new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'; }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2600); }

  async function api(method, url, body) {
    var res = await fetch(url, { method: method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    if (res.status === 401) { showLogin(); throw new Error('Iniciá sesión para continuar'); }
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((data && data.error) || 'Algo salió mal (' + res.status + ')');
    return data;
  }

  // ---------------------------------------------------------------- sesión
  function showLogin() { $('#shell').hidden = true; $('#login').hidden = false; }
  $('#loginForm').addEventListener('submit', async function (e) {
    e.preventDefault(); $('#lErr').textContent = '';
    try { await api('POST', '/api/auth/login', { email: $('#lEmail').value, password: $('#lPass').value }); await boot(); }
    catch (err) { $('#lErr').textContent = err.message; }
  });
  $('#logout').addEventListener('click', async function () { await api('POST', '/api/auth/logout'); location.hash = ''; showLogin(); });

  async function boot() {
    try { state.me = await api('GET', '/api/me'); } catch (e) { return; }
    $('#login').hidden = true; $('#shell').hidden = false;
    $('#acctName').textContent = state.me.account ? state.me.account.name : 'Administración';
    $('#navAdmin').hidden = !state.me.user.is_superadmin;
    if (!location.hash) location.hash = state.me.account ? '#resumen' : '#admin';
    route();
  }

  var routes = { resumen: resumen, ventas: ventas, leads: leads, subir: subir, lineas: lineas, integraciones: integraciones, ajustes: ajustes, admin: admin };
  async function route() {
    var name = (location.hash || '#resumen').slice(1);
    if (!routes[name]) name = 'resumen';
    document.querySelectorAll('#nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + name); });
    view.innerHTML = '<p class="muted">Cargando…</p>';
    try { await routes[name](); } catch (e) { view.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; }
    refreshPending();
  }
  window.addEventListener('hashchange', route);

  async function refreshPending() {
    if (!state.me || !state.me.account) return;
    try {
      var s = await api('GET', '/api/sales?status=pending');
      var p = $('#pendingPill'); p.hidden = !s.length; p.textContent = s.length;
    } catch (e) {}
  }

  // ---------------------------------------------------------------- resumen
  async function resumen() {
    var d = await api('GET', '/api/summary?days=30');
    var t = d.totals, cur = state.me.account.currency;
    var rows = d.byAd.map(function (r) {
      return '<tr><td>' + esc(r.campaign) + '</td><td>' + esc(r.ad) + '</td><td class="num">' + r.clicks + '</td><td class="num">' + r.chats + '</td><td class="num">' + r.sales + '</td><td class="num">' + money(r.revenue, cur) + '</td><td class="num">' + (r.clicks ? Math.round(r.sales / r.clicks * 1000) / 10 : 0) + '%</td></tr>';
    }).join('');
    var lines = d.byLine.map(function (r) { return '<tr><td>' + esc(r.label) + '</td><td class="mono">' + esc(r.phone) + '</td><td class="num">' + r.clicks + '</td><td class="num">' + r.chats + '</td></tr>'; }).join('');
    view.innerHTML =
      '<h1>Resumen · últimos 30 días</h1>' +
      '<div class="kpis">' +
      kpi('Clics al WhatsApp', t.clicks) + kpi('Chats con código', t.chats) + kpi('Ventas aprobadas', t.sales) +
      kpi('Facturación medida', money(t.revenue, cur)) + kpi('Enviadas a Meta', t.sent_to_meta) + kpi('Por revisar', t.pending) +
      '</div>' +
      '<section class="card stack"><h2>Por campaña y anuncio</h2>' +
      (rows ? '<div class="tablewrap"><table><thead><tr><th>Campaña</th><th>Anuncio</th><th class="num">Clics</th><th class="num">Chats</th><th class="num">Ventas</th><th class="num">Facturación</th><th class="num">Conversión</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<p class="empty-state">Todavía no hay clics. Pegá el script en tu landing (Integraciones) y agregá los parámetros UTM a tus anuncios.</p>') +
      '</section>' +
      '<section class="card stack"><h2>Por número de WhatsApp</h2>' +
      (lines ? '<div class="tablewrap"><table><thead><tr><th>Número</th><th>Teléfono</th><th class="num">Clics</th><th class="num">Chats</th></tr></thead><tbody>' + lines + '</tbody></table></div>' : '<p class="muted">Agregá tus números en "Números de WhatsApp".</p>') +
      '</section>';
  }
  function kpi(label, v) { return '<div class="card kpi"><small>' + esc(label) + '</small><b>' + esc(v) + '</b></div>'; }

  // ---------------------------------------------------------------- ventas
  var salesTab = 'pending';
  async function ventas() {
    var list = await api('GET', '/api/sales?status=' + salesTab);
    var labels = { pending: 'Por revisar', approved: 'Aprobadas', rejected: 'Rechazadas' };
    var tabs = Object.keys(labels).map(function (k) { return '<button type="button" data-tab="' + k + '" aria-pressed="' + (k === salesTab) + '">' + labels[k] + '</button>'; }).join('');
    view.innerHTML = '<div class="row" style="justify-content:space-between"><h1>Ventas</h1><div class="tabs">' + tabs + '</div></div>' +
      (list.length ? '<div class="stack">' + list.map(saleCard).join('') + '</div>' : '<div class="card empty-state">' + (salesTab === 'pending' ? 'No hay ventas por revisar.' : 'Todavía no hay ventas acá.') + '</div>') +
      '<dialog id="imgDlg"><img alt="Comprobante"></dialog>';
    view.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { salesTab = b.dataset.tab; ventas(); }; });
    view.querySelectorAll('.thumb[data-src]').forEach(function (img) { img.onclick = function () { var d = $('#imgDlg'); $('img', d).src = img.dataset.src; d.showModal(); d.onclick = function () { d.close(); }; }; });
    view.querySelectorAll('[data-approve]').forEach(function (b) {
      b.onclick = async function () {
        var id = b.dataset.approve, inp = $('#amt-' + id), amount = inp ? Number(inp.value) : undefined;
        if (inp && !(amount > 0)) { toast('Poné el monto de la venta'); inp.focus(); return; }
        b.disabled = true;
        try { var r = await api('POST', '/api/sales/' + id + '/approve', { amount: amount }); toast(r.capi_status === 'sent' ? 'Aprobada y enviada a Meta' : 'Aprobada (no se envió a Meta: revisá Integraciones)'); ventas(); refreshPending(); }
        catch (e) { toast(e.message); b.disabled = false; }
      };
    });
    view.querySelectorAll('[data-reject]').forEach(function (b) {
      b.onclick = async function () { b.disabled = true; try { await api('POST', '/api/sales/' + b.dataset.reject + '/reject'); toast('Venta rechazada'); ventas(); refreshPending(); } catch (e) { toast(e.message); b.disabled = false; } };
    });
    view.querySelectorAll('[data-resend]').forEach(function (b) {
      b.onclick = async function () { b.disabled = true; try { var r = await api('POST', '/api/sales/' + b.dataset.resend + '/resend'); toast(r.capi_status === 'sent' ? 'Enviada a Meta' : 'No se pudo enviar: ' + r.capi_status); ventas(); } catch (e) { toast(e.message); b.disabled = false; } };
    });
  }
  function saleCard(s) {
    var src = { receipt: 'Comprobante', kommo_stage: 'Etapa de Kommo', manual: 'Manual' }[s.source];
    var capi = { sent: ['ok', 'Enviada a Meta'], error: ['bad', 'Error en Meta'], skipped: ['warn', 'No enviada'], not_sent: ['', 'Sin enviar'] }[s.capi_status];
    var capiWhy = s.capi_status !== 'sent' && s.capi_response ? (s.capi_response.motivo || (s.capi_response.error && (s.capi_response.error.message || s.capi_response.error)) || '') : '';
    var imgUrl = s.receipt_id ? (window.CP_IMG ? window.CP_IMG(s.receipt_id) : '/api/receipts/' + s.receipt_id + '/image') : '';
    var img = s.receipt_id ? '<img class="thumb" loading="lazy" alt="Comprobante" src="' + esc(imgUrl) + '" data-src="' + esc(imgUrl) + '">' : '<div class="thumb empty">Sin imagen</div>';
    var actions = '';
    if (s.status === 'pending') {
      actions = '<div class="row"><label style="display:flex;align-items:center;gap:8px">Monto <input class="amount-edit" id="amt-' + s.id + '" type="number" min="0" step="0.01" value="' + (s.amount || '') + '"></label>' +
        '<button class="btn ok" type="button" data-approve="' + s.id + '">Aprobar y enviar a Meta</button><button class="btn bad" type="button" data-reject="' + s.id + '">Rechazar</button></div>';
    } else if (s.status === 'approved' && s.capi_status !== 'sent') {
      actions = '<div class="row"><button class="btn" type="button" data-resend="' + s.id + '">Reintentar envío a Meta</button></div>';
    }
    return '<article class="card sale">' + img + '<div class="stack" style="gap:10px">' +
      '<div class="row" style="justify-content:space-between"><h3>' + money(s.amount, s.currency) + '</h3><div class="row"><span class="tag">' + esc(src) + '</span>' + (s.status === 'approved' ? '<span class="tag ' + capi[0] + '">' + capi[1] + '</span>' : '') + '</div></div>' +
      (s.review_reason && s.status === 'pending' ? '<div class="reason">' + esc(s.review_reason) + '</div>' : '') +
      '<div class="meta">' +
      (s.code ? '<span>Código <b class="mono">' + esc(s.code) + '</b></span>' : '<span>Sin código</span>') +
      (s.utm_content ? '<span>Anuncio: ' + esc(s.utm_content) + '</span>' : '') +
      (s.bank ? '<span>' + esc(s.bank) + '</span>' : '') +
      (s.operation_id ? '<span>Operación <span class="mono">' + esc(s.operation_id) + '</span></span>' : '') +
      (s.payer_name ? '<span>De: ' + esc(s.payer_name) + '</span>' : '') +
      (s.recipient_name ? '<span>Para: ' + esc(s.recipient_name) + '</span>' : '') +
      (s.confidence != null ? '<span>Confianza IA ' + Math.round(s.confidence * 100) + '%</span>' : '') +
      '<span>' + when(s.created_at) + '</span></div>' +
      (capiWhy ? '<p class="muted" style="font-size:.86rem">' + esc(capiWhy) + '</p>' : '') +
      actions + '</div></article>';
  }

  // ---------------------------------------------------------------- leads
  async function leads(q) {
    var list = await api('GET', '/api/leads' + (q ? '?q=' + encodeURIComponent(q) : ''));
    var st = { clicked: ['', 'Hizo clic'], contacted: ['warn', 'Escribió'], won: ['ok', 'Compró'] };
    view.innerHTML = '<div class="row" style="justify-content:space-between"><h1>Clics y chats</h1><form id="qf" class="row"><input id="q" placeholder="Buscar código" value="' + esc(q || '') + '" style="width:180px"><button class="btn" type="submit">Buscar</button></form></div>' +
      '<section class="card"><div class="tablewrap"><table><thead><tr><th>Código</th><th>Estado</th><th>Clic</th><th>Primer mensaje</th><th>Campaña</th><th>Anuncio</th><th>Número</th><th>Desde anuncio</th></tr></thead><tbody>' +
      (list.map(function (l) {
        return '<tr><td class="mono">' + esc(l.code) + '</td><td><span class="tag ' + st[l.status][0] + '">' + st[l.status][1] + '</span></td><td>' + when(l.created_at) + '</td><td>' + when(l.first_message_at) + '</td><td>' + esc(l.utm_campaign || '—') + '</td><td>' + esc(l.utm_content || '—') + '</td><td>' + esc(l.line || '—') + '</td><td>' + (l.from_ad ? 'Sí' : 'No') + '</td></tr>';
      }).join('') || '<tr><td colspan="8" class="muted">Todavía no hay clics.</td></tr>') +
      '</tbody></table></div></section>';
    $('#qf').onsubmit = function (e) { e.preventDefault(); leads($('#q').value.trim()); };
  }

  // ---------------------------------------------------------------- carga manual
  async function subir() {
    view.innerHTML = '<h1>Cargar comprobante</h1>' +
      '<form id="upf" class="card stack" style="max-width:560px"><p class="muted">Si todavía no conectaste Kommo, subí acá la captura que te mandó el cliente. Poné el código que aparece en su primer mensaje para que la venta se atribuya al anuncio.</p>' +
      '<label>Código del chat<input id="upCode" class="mono" maxlength="8" placeholder="Ej. A1B2C3D4" style="text-transform:uppercase"></label>' +
      '<label>Imagen del comprobante<input id="upImg" type="file" accept="image/jpeg,image/png,image/webp" required></label>' +
      '<button class="btn primary" type="submit">Leer comprobante</button><p id="upOut" role="status"></p></form>';
    $('#upf').onsubmit = async function (e) {
      e.preventDefault();
      var f = $('#upImg').files[0]; if (!f) return;
      if (f.size > 10 * 1024 * 1024) { toast('La imagen pesa más de 10 MB'); return; }
      var btn = $('button', this); btn.disabled = true; $('#upOut').textContent = 'Leyendo…';
      var data = await new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.readAsDataURL(f); });
      try {
        var r = await api('POST', '/api/receipts/upload', { code: $('#upCode').value.trim() || undefined, image: data });
        var msg = { accepted: 'Comprobante leído. La venta quedó registrada.', review: 'Comprobante leído con observaciones: revisalo en Ventas.', not_receipt: 'La imagen no parece un comprobante de pago.', duplicate: 'Ese comprobante ya estaba cargado.', error: 'No se pudo leer la imagen. Probá de nuevo.' }[r.status] || r.status;
        $('#upOut').textContent = msg; if (r.saleId) refreshPending();
      } catch (err) { $('#upOut').textContent = err.message; }
      btn.disabled = false;
    };
  }

  // ---------------------------------------------------------------- líneas
  async function lineas() {
    var list = await api('GET', '/api/lines');
    view.innerHTML = '<h1>Números de WhatsApp</h1><p class="muted">La landing reparte los clics entre los números activos según su peso.</p>' +
      '<section class="card"><div class="tablewrap"><table><thead><tr><th>Nombre</th><th>Número</th><th class="num">Peso</th><th>Estado</th><th></th></tr></thead><tbody>' +
      (list.map(function (l) {
        return '<tr><td>' + esc(l.label) + '</td><td class="mono">' + esc(l.phone) + '</td><td class="num">' + l.weight + '</td><td><span class="tag ' + (l.active ? 'ok' : '') + '">' + (l.active ? 'Activo' : 'Pausado') + '</span></td>' +
          '<td class="row" style="justify-content:flex-end"><button class="btn" type="button" data-toggle="' + l.id + '" data-active="' + l.active + '">' + (l.active ? 'Pausar' : 'Activar') + '</button><button class="btn bad" type="button" data-del="' + l.id + '">Borrar</button></td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted">Todavía no cargaste números.</td></tr>') +
      '</tbody></table></div></section>' +
      '<form id="lf" class="card row" style="align-items:end"><label style="flex:1 1 160px">Nombre<input id="lfL" placeholder="Ej. Vendedor Juan" required></label>' +
      '<label style="flex:1 1 200px">Número con código de país<input id="lfP" inputmode="tel" placeholder="5491155555555" required></label>' +
      '<label style="flex:0 0 90px">Peso<input id="lfW" type="number" min="1" max="100" value="1"></label><button class="btn primary" type="submit">Agregar</button></form>';
    $('#lf').onsubmit = async function (e) {
      e.preventDefault();
      try { await api('POST', '/api/lines', { label: $('#lfL').value, phone: $('#lfP').value, weight: Number($('#lfW').value) }); toast('Número agregado'); lineas(); } catch (err) { toast(err.message); }
    };
    view.querySelectorAll('[data-toggle]').forEach(function (b) { b.onclick = async function () { await api('PATCH', '/api/lines/' + b.dataset.toggle, { active: b.dataset.active !== 'true' }); lineas(); }; });
    view.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = async function () { b.textContent = '¿Seguro?'; b.onclick = async function () { await api('DELETE', '/api/lines/' + b.dataset.del); toast('Número borrado'); lineas(); }; }; });
  }

  // ---------------------------------------------------------------- integraciones
  async function integraciones() {
    var d = await api('GET', '/api/integrations');
    var m = d.meta || {}, k = d.kommo;
    view.innerHTML = '<h1>Integraciones</h1>' +
      '<section class="card stack"><h2>1. Tu landing</h2><p class="muted">Pegá esto en tu landing. El botón tiene que llamar a <span class="mono">openRandomLink()</span>. Si el script carga el píxel, no lo pegues también en el HTML.</p>' +
      '<pre class="snippet" id="snip">' + esc(d.landing.snippet) + '</pre><div class="row"><button class="btn" type="button" id="copySnip">Copiar</button></div>' +
      '<p class="muted">En los anuncios, agregá en "Parámetros de URL": <span class="mono">utm_source=meta&amp;utm_campaign={{campaign.name}}&amp;utm_content={{ad.name}}</span></p></section>' +

      '<form id="mf" class="card stack"><h2>2. Meta (API de conversiones)</h2>' +
      '<div class="grid2"><label>Identificador del píxel<input id="mPix" inputmode="numeric" value="' + esc(m.pixel_id || '') + '" required></label>' +
      '<label>Token de acceso de la API de conversiones<input id="mTok" type="password" autocomplete="off" placeholder="' + (m.has_token ? 'Guardado (dejalo vacío para no cambiarlo)' : 'EAA…') + '"></label>' +
      '<label>Código de prueba (opcional)<input id="mTest" value="' + esc(m.test_event_code || '') + '" placeholder="TEST12345"></label>' +
      '<label style="display:flex;align-items:center;gap:8px;align-self:end"><input id="mInj" type="checkbox" style="width:auto" ' + (m.inject_pixel !== false ? 'checked' : '') + '> El script carga el píxel en la landing</label></div>' +
      '<p class="muted">El token se genera en el Administrador de eventos → tu píxel → Configuración → API de conversiones. Usá el código de prueba solo mientras verificás que lleguen los eventos.</p>' +
      '<div class="row"><button class="btn primary" type="submit">Guardar Meta</button></div></form>' +

      '<form id="kf" class="card stack"><h2>3. Kommo (opcional)</h2>' +
      '<div class="grid2"><label>Dirección de tu Kommo<input id="kUrl" placeholder="https://tuempresa.kommo.com" value="' + esc(k ? k.base_url : '') + '" required></label>' +
      '<label>Token de larga duración<input id="kTok" type="password" autocomplete="off" placeholder="' + (k ? 'Guardado (dejalo vacío para no cambiarlo)' : 'Pegalo acá') + '"></label></div>' +
      '<label>Palabras que marcan una etapa como venta<input id="kWon" value="' + esc(k ? k.won_keywords.join(', ') : 'ganado, compró, venta, vendido, won, cerrado, aprobado, pagado') + '"></label>' +
      '<div class="row"><button class="btn primary" type="submit">Guardar Kommo</button></div>' +
      (k ? '<div class="stack"><p><b>URL del webhook</b> (pegala en Kommo → Configuración → Integraciones → Webhooks):</p><pre class="snippet" id="whUrl">' + esc(k.webhook_url) + '</pre>' +
        '<div class="row"><button class="btn" type="button" id="copyWh">Copiar URL</button></div>' +
        '<ol class="steps"><li>En Kommo, agregá un webhook con esa URL.</li><li>Activá <b>"Nuevo mensaje entrante"</b> (para leer códigos y comprobantes).</li><li>Activá <b>"Modificación de etapa del negocio"</b> (para detectar ventas ganadas).</li></ol>' +
        '<h3 style="font-size:.95rem;margin-top:6px">Últimos avisos recibidos</h3>' +
        (d.kommoEvents.length ? '<div class="tablewrap"><table><tbody>' + d.kommoEvents.map(function (e) { return '<tr><td>' + when(e.created_at) + '</td><td style="white-space:normal">' + esc(e.result || 'procesando…') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">Todavía no llegó ningún aviso de Kommo.</p>') +
        '</div>' : '') + '</form>';

    function copy(id) { var t = $(id).textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Copiado'); }, function () { var r = document.createRange(); r.selectNodeContents($(id)); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Seleccionado: copialo con Ctrl+C'); }); }
    $('#copySnip').onclick = function () { copy('#snip'); };
    if ($('#copyWh')) $('#copyWh').onclick = function () { copy('#whUrl'); };
    $('#mf').onsubmit = async function (e) {
      e.preventDefault();
      try { await api('PUT', '/api/integrations/meta', { pixel_id: $('#mPix').value.trim(), capi_token: $('#mTok').value.trim() || undefined, test_event_code: $('#mTest').value.trim() || null, inject_pixel: $('#mInj').checked }); toast('Meta guardado'); integraciones(); } catch (err) { toast(err.message); }
    };
    $('#kf').onsubmit = async function (e) {
      e.preventDefault();
      var won = $('#kWon').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      try { await api('PUT', '/api/integrations/kommo', { base_url: $('#kUrl').value.trim(), token: $('#kTok').value.trim() || undefined, won_keywords: won }); toast('Kommo guardado'); integraciones(); } catch (err) { toast(err.message); }
    };
  }

  // ---------------------------------------------------------------- ajustes
  async function ajustes() {
    var a = await api('GET', '/api/settings');
    view.innerHTML = '<h1>Ajustes</h1><form id="sf" class="card stack" style="max-width:640px">' +
      '<label>Nombre del negocio<input id="sName" value="' + esc(a.name) + '"></label>' +
      '<label>Aprobación de ventas<select id="sMode"><option value="manual"' + (a.approval_mode === 'manual' ? ' selected' : '') + '>Manual: reviso cada venta antes de enviarla a Meta (recomendado al empezar)</option><option value="auto"' + (a.approval_mode === 'auto' ? ' selected' : '') + '>Automática: se envían solas si no hay nada raro</option></select></label>' +
      '<label>Confianza mínima de la IA para aprobar sola (%)<input id="sConf" type="number" min="50" max="100" value="' + Math.round(Number(a.auto_min_confidence) * 100) + '"></label>' +
      '<label>Tus datos de cobro (separados por coma)<input id="sKw" value="' + esc(a.recipient_keywords.join(', ')) + '" placeholder="Tu nombre, tu alias, tu CBU o CVU"></label>' +
      '<p class="muted">Si un comprobante no menciona ninguno de estos datos como destinatario, va a revisión: así se frenan comprobantes de pagos hechos a otra persona.</p>' +
      '<label>Mensaje que se precarga en WhatsApp<input id="sMsg" value="' + esc(a.message_template) + '"></label><p class="muted">Tiene que incluir <span class="mono">{code}</span>, que se reemplaza por el código del cliente.</p>' +
      '<label>Moneda<input id="sCur" maxlength="3" value="' + esc(a.currency) + '" style="width:100px;text-transform:uppercase"></label>' +
      '<div class="row"><button class="btn primary" type="submit">Guardar</button></div></form>';
    $('#sf').onsubmit = async function (e) {
      e.preventDefault();
      var msg = $('#sMsg').value.trim();
      if (msg.indexOf('{code}') < 0) { toast('El mensaje tiene que incluir {code}'); return; }
      try {
        await api('PUT', '/api/settings', { name: $('#sName').value, approval_mode: $('#sMode').value, auto_min_confidence: Number($('#sConf').value) / 100, recipient_keywords: $('#sKw').value.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s.length >= 2; }), message_template: msg, currency: $('#sCur').value });
        toast('Ajustes guardados');
      } catch (err) { toast(err.message); }
    };
  }

  // ---------------------------------------------------------------- admin
  async function admin() {
    var list = await api('GET', '/api/admin/accounts');
    view.innerHTML = '<h1>Cuentas</h1><section class="card"><div class="tablewrap"><table><thead><tr><th>Negocio</th><th>Dueño</th><th class="num">Clics 30 d</th><th class="num">Ventas 30 d</th><th>Estado</th><th></th></tr></thead><tbody>' +
      (list.map(function (a) {
        return '<tr><td>' + esc(a.name) + '</td><td>' + esc(a.owner || '—') + '</td><td class="num">' + a.clicks_30d + '</td><td class="num">' + a.sales_30d + '</td><td><span class="tag ' + (a.active ? 'ok' : 'bad') + '">' + (a.active ? 'Activa' : 'Suspendida') + '</span></td><td><button class="btn" type="button" data-acc="' + a.id + '" data-active="' + a.active + '">' + (a.active ? 'Suspender' : 'Reactivar') + '</button></td></tr>';
      }).join('') || '<tr><td colspan="6" class="muted">Sin cuentas.</td></tr>') + '</tbody></table></div></section>' +
      '<form id="af" class="card stack" style="max-width:640px"><h2>Nueva cuenta</h2><div class="grid2"><label>Negocio<input id="aN" required></label><label>Email del dueño<input id="aE" type="email" required></label></div>' +
      '<label>Contraseña inicial (mínimo 10 caracteres)<input id="aP" type="text" minlength="10" required></label><div class="row"><button class="btn primary" type="submit">Crear cuenta</button></div></form>';
    $('#af').onsubmit = async function (e) {
      e.preventDefault();
      try { await api('POST', '/api/admin/accounts', { name: $('#aN').value, owner_email: $('#aE').value, owner_password: $('#aP').value }); toast('Cuenta creada'); admin(); } catch (err) { toast(err.message); }
    };
    view.querySelectorAll('[data-acc]').forEach(function (b) { b.onclick = async function () { await api('PATCH', '/api/admin/accounts/' + b.dataset.acc, { active: b.dataset.active !== 'true' }); admin(); }; });
  }

  boot();
})();
