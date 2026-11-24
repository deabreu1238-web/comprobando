// Panel de la agencia PanelPro: clientes, pagos, pagos parciales y deuda. Solo para el administrador.
(function () {
  'use strict';
  var CFG = window.CAJA_CONFIG || {};
  var DEMO = !CFG.supabaseUrl || !CFG.supabaseAnonKey;
  var sb = DEMO ? null : window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
  var app = document.getElementById('app');
  var S = { me: null };

  // ------------------------------------------------------------ utilidades
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function fmtN(v, d) { return n(v).toLocaleString('es-AR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function money(v) { var x = n(v), a = Math.abs(x), s = x < 0 ? '−$' : '$';
    if (a >= 1e6) return s + fmtN(a / 1e6, 1) + 'M';
    if (a >= 1e4) return s + fmtN(Math.round(a / 1e3)) + 'K';
    return s + fmtN(Math.round(a)); }
  function full(v) { var x = n(v); return (x < 0 ? '−$' : '$') + fmtN(Math.abs(Math.round(x))); }
  function pct(v, d) { return fmtN(v, d == null ? 1 : d) + '%'; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, k) { var d = parse(s); d.setDate(d.getDate() + k); return iso(d); }
  function today() { return iso(new Date()); }
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function short(s) { var d = parse(s); return String(d.getDate()).padStart(2, '0') + '-' + MES[d.getMonth()]; }
  function longD(s) { var d = parse(s); return d.getDate() + ' de ' + MESL[d.getMonth()] + ' de ' + d.getFullYear(); }
  function days(a, b) { var out = [], c = a; while (c <= b) { out.push(c); c = addDays(c, 1); } return out; }
  function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2800); }
  function median(a) { if (!a.length) return 0; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  var I = {
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12.5h2M3 9.5h13"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l5-5 4 4 7-7M15 8h5v5"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M14.5 8.5c-.4-.6-1.3-1-2.4-1-1.4 0-2.4.7-2.4 1.6s1 1.4 2.4 1.7 2.5.8 2.5 1.8-1.1 1.7-2.5 1.7c-1.1 0-2-.4-2.5-1.1M12 6.5v1M12 14.3v1"/></svg>',
    pct: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6 6 18"/><circle cx="7.5" cy="7.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/></svg>',
    mega: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h3l7 4V6L7 10H4zM17 9a4 4 0 0 1 0 6"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8M9 17h6"/></svg>',
    chips: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="9" r="5"/><circle cx="15" cy="15" r="5"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 16a8 8 0 1 1 16 0M12 16l4-5"/></svg>',
    pie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3v9h9a9 9 0 1 1-9-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.4 3.4-5.3 6.5-5.3s5.7 1.9 6.5 5.3M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.9c2 .7 3.2 2.4 3.6 5.1"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>',
    funnel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/></svg>',
    award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9.2 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.6 1.5c.1.3 0 .5-.1.7l-.5.6c.6 1.1 1.5 2 2.6 2.6l.6-.5c.2-.2.5-.2.7-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3-.1.6-.5.8-.6.3-1.5.4-2.6-.1a9.7 9.7 0 0 1-4.6-4.6c-.5-1.1-.4-2-.1-2.4z" fill="currentColor" stroke="none"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
  };
  var MARK = '<span class="mark"><svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2 12 6 7l3 3 5-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

  function cur(v, m) { return m === 'ARS' ? full(v) : 'US$ ' + fmtN(Math.round(n(v))); }
  function waTo(num, text) { var d = String(num || '').replace(/\D/g, ''); return d ? 'https://wa.me/' + d + '?text=' + encodeURIComponent(text) : null; }
  function shell() {
    return '<div class="top"><div class="brand">' + MARK + esc(CFG.marca || 'PanelPro') + '<span class="brand-sub">Agencia</span></div>' +
      '<div class="who">' + (DEMO ? '<span class="chip demo">Demo</span>' : '') + '<span class="chip admin">Solo admin</span>' + (arguments[1] || '') + '</div></div>';
  }

  // ------------------------------------------------------------ acceso (solo administrador)
  function authCard(inner) { return '<div class="auth"><div class="auth-card"><div class="brand">' + MARK + esc(CFG.marca || 'PanelPro') + '<span class="brand-sub">Agencia</span></div>' + inner + '</div></div>'; }
  function renderLogin(msg) {
    app.innerHTML = '<div class="auth"><form class="auth-card" id="lf"><div class="brand">' + MARK + esc(CFG.marca || 'PanelPro') + '<span class="brand-sub">Agencia</span></div>' +
      '<h1>Cuentas de la agencia</h1><p class="muted">Acceso exclusivo del administrador.</p>' +
      '<label class="field">Email<input id="le" type="email" autocomplete="username" required></label>' +
      '<label class="field">Contraseña<input id="lp" type="password" autocomplete="current-password" required></label>' +
      '<button class="btn pri" type="submit">Entrar</button><p class="err" id="lerr" role="alert">' + esc(msg || '') + '</p>' +
      '<button class="link" type="button" id="forgot">Olvidé mi contraseña</button></form></div>';
    $('#lf').onsubmit = async function (e) {
      e.preventDefault(); $('#lerr').textContent = ''; var b = $('button[type=submit]', this); b.disabled = true;
      var r = await sb.auth.signInWithPassword({ email: $('#le').value.trim(), password: $('#lp').value }); b.disabled = false;
      if (r.error) { $('#lerr').textContent = 'Email o contraseña incorrectos.'; return; }
      loadMe();
    };
    $('#forgot').onclick = async function () {
      var em = $('#le').value.trim();
      if (!em) { $('#lerr').textContent = 'Escribí tu email arriba y volvé a tocar "Olvidé mi contraseña".'; return; }
      await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname });
      $('#lerr').innerHTML = '<span class="ok-msg">Si el email tiene acceso, te llegó un link para crear una contraseña nueva.</span>';
    };
  }
  function renderSetPassword() {
    app.innerHTML = '<div class="auth"><form class="auth-card" id="pf0"><div class="brand">' + MARK + esc(CFG.marca || 'PanelPro') + '<span class="brand-sub">Agencia</span></div><h1>Creá tu contraseña</h1>' +
      '<label class="field">Contraseña nueva<input id="p1" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<label class="field">Repetila<input id="p2" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<button class="btn pri" type="submit">Guardar y entrar</button><p class="err" id="perr0" role="alert"></p></form></div>';
    $('#pf0').onsubmit = async function (e) {
      e.preventDefault();
      if ($('#p1').value !== $('#p2').value) { $('#perr0').textContent = 'Las contraseñas no coinciden.'; return; }
      var r = await sb.auth.updateUser({ password: $('#p1').value });
      if (r.error) { $('#perr0').textContent = 'No se pudo guardar. Probá con otra contraseña.'; return; }
      history.replaceState(null, '', location.pathname); toast('Contraseña guardada'); loadMe();
    };
  }
  async function logout() { if (sb) await sb.auth.signOut(); S.me = null; renderLogin(); }
  async function loadMe() {
    var u = (await sb.auth.getUser()).data.user;
    if (!u) return renderLogin();
    var p = await sb.from('perfiles').select('id,email,rol,activo').eq('id', u.id).maybeSingle();
    if (p.error || !p.data || p.data.rol !== 'admin' || !p.data.activo) {
      await sb.auth.signOut();
      return renderLogin('Este panel es solo para el administrador de la agencia.');
    }
    S.me = p.data; renderAgencia();
  }
  async function start() {
    if (DEMO) { S.me = { email: 'vos@panelpro', rol: 'admin' }; return renderAgencia(); }
    var mustSet = /type=(invite|recovery)/.test(location.hash);
    sb.auth.onAuthStateChange(function (ev) { if (ev === 'PASSWORD_RECOVERY') renderSetPassword(); });
    var r = await sb.auth.getSession();
    if (!r.data.session) return renderLogin();
    if (mustSet) return renderSetPassword();
    loadMe();
  }

  // ------------------------------------------------------------ cuentas de la agencia
  var AG = { clientes: [], pagos: [], q: '', filtro: 'activos' };
  var MEDIOS = ['Transferencia', 'Efectivo', 'Mercado Pago', 'Cripto', 'Otro'];
  function mes(d) { return (d || today()).slice(0, 7); }
  function mesLargo(p) { var x = p.split('-'); return MESL[+x[1] - 1] + ' ' + x[0]; }
  function mesCorto(p) { var x = p.split('-'); return MES[+x[1] - 1] + (x[0] !== today().slice(0, 4) ? " '" + x[0].slice(2) : ''); }
  function addMes(p, k) { var x = p.split('-'), d = new Date(+x[0], +x[1] - 1 + k, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function mesesEntre(a, b) { var out = [], c = a; while (c <= b && out.length < 120) { out.push(c); c = addMes(c, 1); } return out; }
  function mesesDesde(d) { var a = parse(d), b = parse(today()); return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); }

  function pagado(c, periodo) { return AG.pagos.filter(function (p) { return p.cliente_id === c.id && (!periodo || p.periodo === periodo); }).reduce(function (s, p) { return s + n(p.monto); }, 0); }
  // Estado de cuenta: qué se esperaba cobrar y cuánto falta, mes por mes desde "cobrar_desde".
  function cuenta(c) {
    var hoy = mes(), desde = mes(c.cobrar_desde || c.fecha_ingreso), monto = n(c.monto), r = { meses: [], deuda: 0, mesActual: null };
    if (c.frecuencia === 'unico') {
      var pg = pagado(c), falta = Math.max(0, monto - pg);
      r.mesActual = { periodo: desde, esperado: monto, pagado: pg, falta: falta, estado: !monto ? 'sin' : falta <= 0 ? 'pagado' : pg > 0 ? 'parcial' : 'pendiente' };
      r.deuda = falta; r.meses.push(r.mesActual); return r;
    }
    mesesEntre(desde, hoy).forEach(function (p) {
      var activo = c.estado === 'activo' || AG.pagos.some(function (x) { return x.cliente_id === c.id && x.periodo === p; });
      var esp = activo ? monto : 0, pg = pagado(c, p), f = Math.max(0, esp - pg);
      var m = { periodo: p, esperado: esp, pagado: pg, falta: f, estado: !esp ? (pg ? 'pagado' : 'sin') : f <= 0 ? 'pagado' : pg > 0 ? 'parcial' : 'pendiente' };
      r.meses.push(m); if (p < hoy) r.deuda += f;
    });
    r.mesActual = r.meses[r.meses.length - 1] || { periodo: hoy, esperado: 0, pagado: 0, falta: 0, estado: 'sin' };
    r.deuda += r.mesActual.falta;
    return r;
  }
  function sumBy(list, f) { var o = { USD: 0, ARS: 0 }; list.forEach(function (x) { o[x.moneda || 'USD'] += f(x); }); return o; }
  function both2(o) { var s = []; if (o.USD || !o.ARS) s.push(cur(o.USD, 'USD')); if (o.ARS) s.push(cur(o.ARS, 'ARS')); return s.join(' + '); }

  function demoAgencia() {
    var t = today(), m0 = mes(), uid = function (i) { return 'a' + i; };
    AG.clientes = [
      ['Panel Norte', 'Pauta + Dashboard', -140, 2, 700, 'USD', 'activo', '5491100000001'],
      ['Grupo Delta', 'Pauta Meta Ads', -95, 3, 900, 'USD', 'activo', '5491100000002'],
      ['Litoral Play', 'Pauta Meta Ads', -60, 1, 500, 'USD', 'activo', ''],
      ['Costa', 'Estructura WhatsApp', -40, 1, 350000, 'ARS', 'activo', '5491100000004'],
      ['Andes', 'Mentoría 1 a 1', -25, 0, 400, 'USD', 'activo', ''],
      ['Sur Gaming', 'Pauta Meta Ads', -200, 2, 600, 'USD', 'baja', ''],
    ].map(function (x, i) { return { id: uid(i), nombre: x[0], servicio: x[1], fecha_ingreso: addDays(t, x[2]), cuentas_publicitarias: x[3], monto: x[4], moneda: x[5], frecuencia: i === 4 ? 'unico' : 'mensual', estado: x[6], contacto: x[7], cobrar_desde: addMes(m0, i === 0 ? -3 : i === 1 ? -2 : -1) + '-01', notas: i === 1 ? 'Paga en dos partes: mitad a principio y mitad a mitad de mes.' : '' }; });
    var P = [];
    function pay(i, k, monto, med, dia) { P.push({ id: 'p' + P.length, cliente_id: uid(i), periodo: addMes(m0, k), monto: monto, moneda: AG.clientes[i].moneda, medio: med, fecha: addMes(m0, k) + '-' + String(dia || 5).padStart(2, '0'), nota: '' }); }
    pay(0, -3, 700, 'Transferencia'); pay(0, -2, 700, 'Transferencia'); pay(0, -1, 700, 'Cripto'); pay(0, 0, 700, 'Transferencia', 3);
    pay(1, -2, 900, 'Transferencia'); pay(1, -1, 450, 'Transferencia'); pay(1, -1, 450, 'Transferencia', 16); pay(1, 0, 450, 'Transferencia', 4);
    pay(2, -1, 500, 'Mercado Pago');
    pay(3, -1, 350000, 'Transferencia'); pay(3, 0, 200000, 'Efectivo', 8);
    pay(4, -1, 200, 'Mercado Pago', 20);
    AG.pagos = P;
  }

  async function renderAgencia() {
    app.innerHTML = '<div class="wrap">' + shell('agencia', '') + '<p class="muted">Cargando cuentas…</p></div>';
    if (DEMO) { demoAgencia(); return drawAgencia(); }
    var r = await Promise.all([sb.from('agencia_clientes').select('*').order('fecha_ingreso', { ascending: false }), sb.from('agencia_pagos').select('*').order('fecha', { ascending: false }).limit(5000)]);
    if (r[0].error || r[1].error) {
      app.innerHTML = '<div class="wrap">' + shell('agencia', '') + '<p class="note-warn">Para usar las cuentas de la agencia, corré en Supabase el archivo <b>supabase-actualizacion-2.sql</b> (SQL Editor → New query → Run) y recargá esta página.</p></div>';
      return;
    }
    AG.clientes = r[0].data; AG.pagos = r[1].data; drawAgencia();
  }

  function estadoPill(m) {
    if (m.estado === 'pagado') return '<span class="pill ok">Pagado</span>';
    if (m.estado === 'parcial') return '<span class="pill warn">Parcial · debe ' + cur(m.falta, m.moneda) + '</span>';
    if (m.estado === 'pendiente') return '<span class="pill bad">Pendiente</span>';
    return '<span class="pill none">Sin cobro</span>';
  }

  function drawAgencia() {
    var hoy = mes(), act = AG.clientes.filter(function (c) { return c.estado === 'activo'; });
    AG.clientes.forEach(function (c) { c._c = cuenta(c); c._c.mesActual.moneda = c.moneda; c._total = pagado(c); });
    var cobradoMes = sumBy(AG.pagos.filter(function (p) { return p.fecha && p.fecha.slice(0, 7) === hoy; }), function (p) { return n(p.monto); });
    var porCobrar = sumBy(AG.clientes, function (c) { return c._c.deuda; });
    var mrr = sumBy(act.filter(function (c) { return c.frecuencia === 'mensual'; }), function (c) { return n(c.monto); });
    var cuentasAds = act.reduce(function (s, c) { return s + n(c.cuentas_publicitarias); }, 0);
    var deudores = AG.clientes.filter(function (c) { return c._c.deuda > 0; }).sort(function (a, b) { return b._c.deuda - a._c.deuda; });
    // cobrado por mes (últimos 6), por moneda principal
    var meses6 = mesesEntre(addMes(hoy, -5), hoy), main = mrr.ARS > mrr.USD && !mrr.USD ? 'ARS' : 'USD';
    var serie = meses6.map(function (p) { return AG.pagos.filter(function (x) { return x.fecha && x.fecha.slice(0, 7) === p && (x.moneda || 'USD') === main; }).reduce(function (s, x) { return s + n(x.monto); }, 0); });
    var q = AG.q.toLowerCase(), list = AG.clientes.filter(function (c) { return (AG.filtro === 'todos' || (AG.filtro === 'activos' ? c.estado === 'activo' : AG.filtro === 'deben' ? c._c.deuda > 0 : c.estado !== 'activo')) && (!q || (c.nombre + ' ' + c.servicio).toLowerCase().indexOf(q) >= 0); })
      .sort(function (a, b) { return (b._c.deuda > 0) - (a._c.deuda > 0) || (a.estado === 'activo' ? 0 : 1) - (b.estado === 'activo' ? 0 : 1) || a.nombre.localeCompare(b.nombre); });

    var h = '<div class="wrap">' + shell('agencia', '<span class="hide-sm">' + esc(S.me.email) + '</span>' + (DEMO ? '' : '<button class="btn sm" id="out">Salir</button>')) +
      '<div class="head"><div><span class="lbl">Cuentas de la agencia · ' + mesLargo(hoy) + '</span><h1>Agencia</h1><p class="range">' + act.length + ' clientes activos · ' + cuentasAds + ' cuentas publicitarias gestionadas</p></div>' +
      '<div class="actions"><button class="btn" id="csv">' + I.dl + ' Exportar</button><button class="btn pri" id="nuevo">' + I.plus + ' Nuevo cliente</button></div></div>';
    h += '<section class="kpis">' +
      '<article class="card kpi" style="--c:var(--green)"><div class="ch"><span class="ico">' + I.wallet + '</span><span class="lbl">Cobrado este mes</span></div><div class="val">' + both2(cobradoMes) + '</div><div class="vs" style="margin-top:10px">' + AG.pagos.filter(function (p) { return p.fecha && p.fecha.slice(0, 7) === hoy; }).length + ' pagos registrados</div></article>' +
      '<article class="card kpi" style="--c:' + (porCobrar.USD || porCobrar.ARS ? 'var(--red)' : 'var(--green)') + '"><div class="ch"><span class="ico">' + I.receipt + '</span><span class="lbl">Por cobrar</span></div><div class="val">' + both2(porCobrar) + '</div><div class="vs" style="margin-top:10px">' + (deudores.length ? deudores.length + (deudores.length === 1 ? ' cliente debe' : ' clientes deben') : 'nadie debe nada') + '</div></article>' +
      '<article class="card kpi" style="--c:var(--blue)"><div class="ch"><span class="ico">' + I.up + '</span><span class="lbl">Ingreso mensual fijo</span></div><div class="val">' + both2(mrr) + '</div><div class="vs" style="margin-top:10px">abonos mensuales activos</div></article>' +
      '<article class="card kpi" style="--c:var(--violet)"><div class="ch"><span class="ico">' + I.users + '</span><span class="lbl">Cuentas gestionadas</span></div><div class="val">' + cuentasAds + '</div><div class="vs" style="margin-top:10px">en ' + act.length + ' clientes activos</div></article></section>';
    h += '<section class="grid2">';
    h += '<article class="card" style="--c:var(--red)"><div class="ch"><span class="ico">' + I.list + '</span><div><h2>Quién debe</h2><p class="sub">Pagos pendientes y parciales, del más grande al más chico</p></div></div>' +
      (deudores.length ? '<div class="todo">' + deudores.map(function (c) {
        var atras = c._c.meses.filter(function (m) { return m.falta > 0; });
        var det = atras.map(function (m) { return mesCorto(m.periodo) + ': ' + (m.estado === 'parcial' ? 'pagó ' + cur(m.pagado, c.moneda) + ' de ' + cur(m.esperado, c.moneda) : 'no pagó'); }).join(' · ');
        var wa = waTo(c.contacto, 'Hola! Te escribo por el saldo pendiente de ' + cur(c._c.deuda, c.moneda) + '. ¿Me pasás el comprobante cuando lo tengas? Gracias!');
        return '<div class="td ' + (atras.some(function (m) { return m.periodo < hoy; }) ? 'crit' : '') + '"><div><h3><b>' + esc(c.nombre) + '</b> · debe ' + cur(c._c.deuda, c.moneda) + '</h3><p>' + esc(det) + '</p></div><div class="acts"><button class="btn sm ok" data-pago="' + c.id + '">Registrar pago</button>' + (wa ? '<a class="btn sm" href="' + wa + '" target="_blank" rel="noopener">' + I.wa + ' Recordar</a>' : '') + '</div></div>';
      }).join('') + '</div>' : '<p class="muted" style="margin-top:14px">Todos al día. Nadie debe nada.</p>') + '</article>';
    var mx = Math.max.apply(null, serie.concat([1]));
    h += '<article class="card" style="--c:var(--green)"><div class="ch"><span class="ico">' + I.up + '</span><div><h2>Cobrado por mes</h2><p class="sub">Últimos 6 meses' + (main === 'ARS' ? ' (pesos)' : ' (dólares)') + '</p></div></div><div class="mbars">' +
      meses6.map(function (p, i) { return '<div class="mb' + (p === hoy ? ' now' : '') + '"><b class="num">' + (serie[i] ? money(serie[i]).replace('$', main === 'USD' ? 'US$ ' : '$') : '—') + '</b><i style="height:' + Math.max(2, serie[i] / mx * 100).toFixed(0) + '%"></i><span>' + mesCorto(p) + '</span></div>'; }).join('') + '</div></article>';
    h += '</section>';
    h += '<section class="grid2"><article class="card wide" style="--c:var(--blue)"><div class="ch"><span class="ico">' + I.users + '</span><div><h2>Clientes de la agencia</h2><p class="sub">Los que deben aparecen primero</p></div><input id="agq" class="search" type="search" placeholder="Buscar cliente" aria-label="Buscar cliente" value="' + esc(AG.q) + '"></div>' +
      '<div class="picks" style="margin-top:12px">' + [['activos', 'Activos'], ['deben', 'Deben'], ['bajas', 'Pausados y bajas'], ['todos', 'Todos']].map(function (f) { return '<button class="pick" data-agf="' + f[0] + '" aria-pressed="' + (AG.filtro === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div class="tbl-wrap"><table class="table adm"><thead><tr><th>Cliente</th><th>Ingresó</th><th>Cuentas</th><th>Acordado</th><th>' + mesLargo(hoy).replace(/ \d+$/, '') + '</th><th>Total cobrado</th><th></th></tr></thead><tbody>' +
      (list.map(function (c) {
        var m = c._c.mesActual, ant = mesesDesde(c.fecha_ingreso);
        return '<tr' + (c.estado === 'activo' ? '' : ' class="off-row"') + '><td><b>' + esc(c.nombre) + '</b>' + (c.estado !== 'activo' ? ' <span class="st off">' + (c.estado === 'baja' ? 'Baja' : 'Pausado') + '</span>' : '') + '<br><span class="muted">' + esc(c.servicio || '—') + '</span>' + (c.notas ? '<br><span class="note">' + esc(c.notas) + '</span>' : '') + '</td>' +
          '<td>' + short(c.fecha_ingreso) + '<br><span class="muted">' + (ant < 1 ? 'este mes' : ant === 1 ? 'hace 1 mes' : 'hace ' + ant + ' meses') + '</span></td>' +
          '<td class="num"><b>' + n(c.cuentas_publicitarias) + '</b></td>' +
          '<td><b class="num">' + cur(c.monto, c.moneda) + '</b><br><span class="muted">' + (c.frecuencia === 'unico' ? 'pago único' : 'por mes') + '</span></td>' +
          '<td>' + estadoPill(m) + (m.pagado && m.estado !== 'pagado' ? '' : '') + (c._c.deuda > m.falta ? '<br><span class="pill bad" style="margin-top:4px">Arrastra ' + cur(c._c.deuda - m.falta, c.moneda) + '</span>' : '') + '</td>' +
          '<td class="num"><b>' + cur(c._total, c.moneda) + '</b></td>' +
          '<td><div class="actions"><button class="btn sm ok" data-pago="' + c.id + '">Pago</button><button class="btn sm" data-hist="' + c.id + '">Historial</button><button class="btn sm" data-agedit="' + c.id + '">Editar</button></div></td></tr>';
      }).join('') || '<tr><td colspan="7" class="muted">' + (AG.clientes.length ? 'Ningún cliente en este filtro.' : 'Todavía no cargaste clientes. Tocá "Nuevo cliente".') + '</td></tr>') +
      '</tbody></table></div></article></section></div>';
    app.innerHTML = h;
    if ($('#out')) $('#out').onclick = logout;
    $('#nuevo').onclick = function () { editAg(null); };
    $('#csv').onclick = exportAg;
    $('#agq').oninput = function () { AG.q = this.value; var pos = this.selectionStart; drawAgencia(); var i = $('#agq'); i.focus(); i.setSelectionRange(pos, pos); };
    $$('[data-agf]').forEach(function (b) { b.onclick = function () { AG.filtro = b.dataset.agf; drawAgencia(); }; });
    function byId(id) { return AG.clientes.find(function (c) { return c.id === id; }); }
    $$('[data-pago]').forEach(function (b) { b.onclick = function () { pagoAg(byId(b.dataset.pago)); }; });
    $$('[data-hist]').forEach(function (b) { b.onclick = function () { histAg(byId(b.dataset.hist)); }; });
    $$('[data-agedit]').forEach(function (b) { b.onclick = function () { editAg(byId(b.dataset.agedit)); }; });
  }

  function modal(html) { var d = document.createElement('dialog'); d.innerHTML = html; document.body.appendChild(d); d.showModal(); d.addEventListener('close', function () { d.remove(); }); return d; }

  function editAg(c) {
    var nuevo = !c; c = c || { nombre: '', servicio: 'Pauta Meta Ads', fecha_ingreso: today(), cuentas_publicitarias: 1, monto: '', moneda: 'USD', frecuencia: 'mensual', estado: 'activo', contacto: '', notas: '', cobrar_desde: mes() + '-01' };
    var d = modal('<form class="modal" id="agf"><h2>' + (nuevo ? 'Nuevo cliente' : esc(c.nombre)) + '</h2><div class="fgrid">' +
      '<label class="field full">Nombre del cliente<input id="g_n" required maxlength="80" value="' + esc(c.nombre) + '"></label>' +
      '<label class="field">Servicio<input id="g_s" maxlength="80" value="' + esc(c.servicio) + '" placeholder="Pauta Meta Ads"></label>' +
      '<label class="field">Fecha de ingreso<input id="g_f" type="date" required value="' + c.fecha_ingreso + '"></label>' +
      '<label class="field">Cuentas publicitarias que le manejás<input id="g_c" type="number" min="0" step="1" inputmode="numeric" value="' + n(c.cuentas_publicitarias) + '"></label>' +
      '<label class="field">Estado<select id="g_e">' + [['activo', 'Activo'], ['pausado', 'Pausado'], ['baja', 'Dado de baja']].map(function (x) { return '<option value="' + x[0] + '"' + (c.estado === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '<span class="lbl fsec">Lo que paga</span>' +
      '<label class="field">Monto acordado<input id="g_m" type="number" min="0" step="1" inputmode="numeric" required value="' + (n(c.monto) || '') + '"></label>' +
      '<label class="field">Moneda<select id="g_mo"><option value="USD"' + (c.moneda !== 'ARS' ? ' selected' : '') + '>Dólares (US$)</option><option value="ARS"' + (c.moneda === 'ARS' ? ' selected' : '') + '>Pesos ($)</option></select></label>' +
      '<label class="field">Cómo paga<select id="g_fr"><option value="mensual"' + (c.frecuencia !== 'unico' ? ' selected' : '') + '>Todos los meses</option><option value="unico"' + (c.frecuencia === 'unico' ? ' selected' : '') + '>Pago único</option></select></label>' +
      '<label class="field">Controlar pagos desde<input id="g_d" type="month" value="' + mes(c.cobrar_desde) + '"></label>' +
      '<label class="field full">WhatsApp (con 549…)<input id="g_w" inputmode="tel" placeholder="5491155555555" value="' + esc(c.contacto) + '"></label>' +
      '<label class="field full">Notas<textarea id="g_t" rows="2" maxlength="500" placeholder="Ej: paga en dos partes, factura a nombre de…">' + esc(c.notas) + '</textarea></label>' +
      '</div><p class="muted" style="font-size:12.5px;margin:0">"Controlar pagos desde" es el primer mes que el panel revisa. Los meses anteriores no cuentan como deuda.</p><p class="err" id="gerr"></p><div class="mrow">' + (nuevo ? '' : '<button class="btn danger" type="button" id="gdel">Eliminar</button>') + '<button class="btn" type="button" id="gx">Cancelar</button><button class="btn pri" type="submit">Guardar</button></div></form>');
    $('#gx', d).onclick = function () { d.close(); };
    if ($('#gdel', d)) $('#gdel', d).onclick = async function () {
      if (this.dataset.sure !== '1') { this.dataset.sure = '1'; this.textContent = '¿Seguro? Se borra con sus pagos'; return; }
      if (!DEMO) { var r = await sb.from('agencia_clientes').delete().eq('id', c.id); if (r.error) { $('#gerr', d).textContent = 'No se pudo eliminar.'; return; } }
      AG.clientes = AG.clientes.filter(function (x) { return x.id !== c.id; }); AG.pagos = AG.pagos.filter(function (p) { return p.cliente_id !== c.id; }); d.close(); toast('Cliente eliminado'); drawAgencia();
    };
    $('#agf', d).onsubmit = async function (e) {
      e.preventDefault();
      var row = { nombre: $('#g_n', d).value.trim(), servicio: $('#g_s', d).value.trim(), fecha_ingreso: $('#g_f', d).value, cuentas_publicitarias: Math.max(0, Math.round(n($('#g_c', d).value))), estado: $('#g_e', d).value,
        monto: Math.max(0, n($('#g_m', d).value)), moneda: $('#g_mo', d).value, frecuencia: $('#g_fr', d).value, cobrar_desde: ($('#g_d', d).value || mes()) + '-01', contacto: $('#g_w', d).value.replace(/\D/g, ''), notas: $('#g_t', d).value.trim() };
      if (!row.nombre) { $('#gerr', d).textContent = 'Poné el nombre del cliente.'; return; }
      if (!DEMO) {
        var r = nuevo ? await sb.from('agencia_clientes').insert(row).select().single() : await sb.from('agencia_clientes').update(row).eq('id', c.id).select().single();
        if (r.error) { $('#gerr', d).textContent = 'No se pudo guardar. Revisá los datos.'; return; }
        row = r.data;
      } else row.id = c.id || 'n' + Date.now();
      if (nuevo) AG.clientes.unshift(row); else Object.assign(c, row);
      d.close(); toast(nuevo ? 'Cliente agregado' : 'Cliente actualizado'); drawAgencia();
    };
  }

  function pagoAg(c) {
    var cu = cuenta(c), pend = cu.meses.filter(function (m) { return m.falta > 0; }), sug = pend[0] || cu.mesActual;
    var opts = mesesEntre(addMes(mes(), -12), addMes(mes(), 2)).reverse();
    var d = modal('<form class="modal" id="pf"><h2>Registrar pago</h2><p class="muted" style="margin-top:-8px">' + esc(c.nombre) + ' · ' + cur(c.monto, c.moneda) + (c.frecuencia === 'unico' ? ' pago único' : ' por mes') + '</p><div class="fgrid">' +
      '<label class="field">Monto que pagó (' + (c.moneda === 'ARS' ? '$' : 'US$') + ')<input id="p_m" type="number" min="0.01" step="0.01" inputmode="decimal" required value="' + (sug.falta || n(c.monto) || '') + '"></label>' +
      '<label class="field">Fecha del pago<input id="p_f" type="date" required value="' + today() + '" max="' + today() + '"></label>' +
      '<label class="field">Corresponde a<select id="p_p">' + opts.map(function (p) { var m = cu.meses.find(function (x) { return x.periodo === p; }); return '<option value="' + p + '"' + (p === sug.periodo ? ' selected' : '') + '>' + mesLargo(p) + (m && m.falta ? ' · falta ' + cur(m.falta, c.moneda) : m && m.estado === 'pagado' ? ' · pagado' : '') + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">Medio<select id="p_md">' + MEDIOS.map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select></label>' +
      '<label class="field full">Nota<input id="p_n" maxlength="200" placeholder="Ej: primera mitad, comprobante por WhatsApp"></label>' +
      '</div><div class="calc" id="p_calc"></div><p class="err" id="perr"></p><div class="mrow"><button class="btn" type="button" id="px">Cancelar</button><button class="btn pri" type="submit">Guardar pago</button></div></form>');
    function calc() {
      var p = $('#p_p', d).value, m = cu.meses.find(function (x) { return x.periodo === p; }) || { esperado: c.frecuencia === 'unico' ? n(c.monto) : n(c.monto), pagado: pagado(c, c.frecuencia === 'unico' ? null : p) };
      var tras = m.pagado + n($('#p_m', d).value), falta = Math.max(0, m.esperado - tras);
      $('#p_calc', d).innerHTML = '<span>' + (falta > 0 ? 'Queda debiendo de ' + mesLargo(p) : 'Con este pago, ' + mesLargo(p) + ' queda') + '</span><b style="color:' + (falta > 0 ? 'var(--amber)' : 'var(--green)') + '">' + (falta > 0 ? cur(falta, c.moneda) + ' (pago parcial)' : 'pagado') + '</b>';
    }
    $('#p_m', d).oninput = calc; $('#p_p', d).onchange = calc; calc();
    $('#px', d).onclick = function () { d.close(); };
    $('#pf', d).onsubmit = async function (e) {
      e.preventDefault();
      var row = { cliente_id: c.id, monto: Math.round(n($('#p_m', d).value) * 100) / 100, fecha: $('#p_f', d).value, periodo: $('#p_p', d).value, moneda: c.moneda, medio: $('#p_md', d).value, nota: $('#p_n', d).value.trim() };
      if (!(row.monto > 0)) { $('#perr', d).textContent = 'Poné un monto mayor a cero.'; return; }
      if (!DEMO) { var r = await sb.from('agencia_pagos').insert(row).select().single(); if (r.error) { $('#perr', d).textContent = 'No se pudo guardar el pago.'; return; } row = r.data; } else row.id = 'p' + Date.now();
      AG.pagos.unshift(row); d.close(); toast('Pago de ' + cur(row.monto, row.moneda) + ' registrado'); drawAgencia();
    };
  }

  function histAg(c) {
    var ps = AG.pagos.filter(function (p) { return p.cliente_id === c.id; }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }), cu = cuenta(c);
    var d = modal('<div class="modal"><h2>' + esc(c.nombre) + '</h2><p class="muted" style="margin-top:-8px">Total cobrado: <b style="color:var(--text)">' + cur(pagado(c), c.moneda) + '</b>' + (cu.deuda ? ' · debe <b style="color:var(--red)">' + cur(cu.deuda, c.moneda) + '</b>' : '') + '</p>' +
      (c.frecuencia === 'mensual' ? '<div class="mstat">' + cu.meses.slice(-12).map(function (m) { return '<span class="ms ' + m.estado + '" title="' + mesLargo(m.periodo) + ': ' + (m.estado === 'parcial' ? 'pagó ' + cur(m.pagado, c.moneda) + ' de ' + cur(m.esperado, c.moneda) : m.estado) + '">' + mesCorto(m.periodo) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="plist">' + (ps.map(function (p) { return '<div class="pi"><div><b class="num">' + cur(p.monto, p.moneda) + '</b> <span class="muted">· ' + short(p.fecha) + ' · ' + esc(p.medio || '—') + '</span><br><span class="muted">Corresponde a ' + mesLargo(p.periodo) + (p.nota ? ' · ' + esc(p.nota) : '') + '</span></div><button class="btn sm danger" data-pdel="' + p.id + '">Borrar</button></div>'; }).join('') || '<p class="muted">Todavía no hay pagos registrados.</p>') + '</div>' +
      '<div class="mrow"><button class="btn" id="hx">Cerrar</button><button class="btn pri" id="hp">Registrar pago</button></div></div>');
    $('#hx', d).onclick = function () { d.close(); };
    $('#hp', d).onclick = function () { d.close(); pagoAg(c); };
    $$('[data-pdel]', d).forEach(function (b) {
      b.onclick = async function () {
        if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Seguro?'; return; }
        if (!DEMO) { var r = await sb.from('agencia_pagos').delete().eq('id', b.dataset.pdel); if (r.error) { toast('No se pudo borrar'); return; } }
        AG.pagos = AG.pagos.filter(function (p) { return p.id !== b.dataset.pdel; }); d.close(); toast('Pago borrado'); drawAgencia(); histAg(c);
      };
    });
  }

  function exportAg() {
    function q(v) { v = String(v == null ? '' : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var rows = [['Cliente', 'Servicio', 'Fecha de ingreso', 'Estado', 'Cuentas publicitarias', 'Monto acordado', 'Moneda', 'Frecuencia', 'Total cobrado', 'Debe']];
    AG.clientes.forEach(function (c) { var cu = cuenta(c); rows.push([c.nombre, c.servicio, c.fecha_ingreso, c.estado, c.cuentas_publicitarias, n(c.monto), c.moneda, c.frecuencia, pagado(c), cu.deuda]); });
    rows.push([]); rows.push(['Pagos']); rows.push(['Cliente', 'Fecha', 'Corresponde a', 'Monto', 'Moneda', 'Medio', 'Nota']);
    AG.pagos.forEach(function (p) { var c = AG.clientes.find(function (x) { return x.id === p.cliente_id; }); rows.push([c ? c.nombre : '', p.fecha, p.periodo, n(p.monto), p.moneda, p.medio, p.nota]); });
    var blob = new Blob(['﻿' + rows.map(function (r) { return r.map(q).join(';'); }).join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cuentas-agencia-' + today() + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Descargando planilla (se abre con Excel o Google Sheets)');
  }


  start().catch(function (e) { console.error(e); app.innerHTML = '<div class="auth"><div class="auth-card"><h1>No se pudo cargar</h1><p class="muted">Revisá tu conexión y recargá la página.</p></div></div>'; });
})();
