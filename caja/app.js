// Dashboard de caja PanelPro: login con Supabase, un tablero por cliente y panel de administración.
(function () {
  'use strict';
  var CFG = window.CAJA_CONFIG || {};
  var DEMO = !CFG.supabaseUrl || !CFG.supabaseAnonKey;
  var sb = DEMO ? null : window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
  var app = document.getElementById('app');
  var S = { me: null, viewing: null, regs: [], period: '30', from: null, to: null, compare: false, clients: [], q: '' };

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

  var GASTOS = [['premios', 'Premios', 'var(--amber)', '#fbbf24'], ['fichas', 'Fichas', 'var(--pink)', '#f472b6'], ['meta_ads', 'Meta Ads', 'var(--cyan)', '#38d9f0'], ['comisiones', 'Comisiones', 'var(--teal)', '#2dd4bf'], ['otros_gastos', 'Otros', 'var(--violet)', '#b18cff']];
  function gastos(r) { return n(r.premios) + n(r.fichas) + n(r.meta_ads) + n(r.comisiones) + n(r.otros_gastos); }
  function neta(r) { return n(r.ingresos) - gastos(r); }

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

  // ------------------------------------------------------------ datos de demostración
  function demoRegs() {
    var out = [], end = today(), seed = 7;
    function r() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var k = 59; k >= 0; k--) {
      var f = addDays(end, -k), t = (59 - k) / 59, base = 1.2e6 + t * 0.9e6;
      var ing = base * (0.8 + r() * 0.45);
      var nu = Math.round(14 + r() * 18 + t * 10), re = Math.round(28 + r() * 22 + t * 12);
      out.push({ fecha: f, ingresos: Math.round(ing), premios: Math.round(ing * (0.42 + r() * 0.12)), fichas: Math.round(ing * (0.09 + r() * 0.03)),
        meta_ads: Math.round(70000 + r() * 50000 + t * 40000), comisiones: Math.round(ing * 0.012), otros_gastos: Math.round(r() * 30000),
        jugadores_nuevos: nu, jugadores_recurrentes: re, jugadores_meta: Math.round(nu * (0.6 + r() * 0.3)), cargas_atribuidas: Math.round(ing * (0.32 + r() * 0.15)) });
    }
    return out;
  }

  // ------------------------------------------------------------ sesión
  async function start() {
    if (DEMO && (location.hash === '#admin' || location.hash === '#agencia')) {
      S.me = { id: 'admin', email: 'vos@panelpro', nombre: 'Admin', rol: 'admin', activo: true }; return adminRoute();
    }
    if (DEMO) {
      S.me = { id: 'demo', email: 'demo@panelpro', nombre: 'Cliente de ejemplo', rol: 'cliente', activo: true, objetivo_diario: 650000 };
      S.viewing = S.me; S.regs = demoRegs(); return renderDash();
    }
    var hash = location.hash;
    var mustSetPassword = /type=(invite|recovery)/.test(hash);
    sb.auth.onAuthStateChange(function (ev) { if (ev === 'PASSWORD_RECOVERY') renderSetPassword(); });
    var r = await sb.auth.getSession();
    if (!r.data.session) return renderLogin();
    if (mustSetPassword) return renderSetPassword();
    await loadMe();
  }

  async function loadMe() {
    var u = (await sb.auth.getUser()).data.user;
    if (!u) return renderLogin();
    var p = await sb.from('perfiles').select('*').eq('id', u.id).maybeSingle();
    if (p.error || !p.data) return renderMessage('No encontramos tu perfil', 'Escribinos por WhatsApp y lo resolvemos.');
    S.me = p.data;
    if (!S.me.activo) return renderMessage('Tu acceso está suspendido', 'Si creés que es un error, escribinos por WhatsApp.');
    if (S.me.rol === 'admin') return adminRoute();
    S.viewing = S.me; await loadRegs(); renderDash();
  }

  async function loadRegs() {
    if (DEMO) return;
    var r = await sb.from('registros').select('*').eq('user_id', S.viewing.id).order('fecha', { ascending: true }).limit(2000);
    if (r.error) { toast('No se pudieron cargar los datos'); S.regs = []; return; }
    S.regs = r.data;
  }

  function waLink(text) { return 'https://wa.me/' + (CFG.whatsapp || '') + '?text=' + encodeURIComponent(text || 'Hola, tengo una consulta sobre mi dashboard de caja.'); }

  function renderLogin(msg) {
    app.innerHTML = '<div class="auth"><form class="auth-card" id="lf">' +
      '<div class="brand">' + MARK + esc(CFG.marca || 'PanelPro') + '</div>' +
      '<h1>Dashboard de caja</h1><p class="muted">Acceso solo para clientes de ' + esc(CFG.marca || 'PanelPro') + '.</p>' +
      '<label class="field">Email<input id="le" type="email" autocomplete="username" required></label>' +
      '<label class="field">Contraseña<input id="lp" type="password" autocomplete="current-password" required></label>' +
      '<button class="btn pri" type="submit">Entrar</button>' +
      '<p class="err" id="lerr" role="alert">' + esc(msg || '') + '</p>' +
      '<button class="link" type="button" id="forgot">Olvidé mi contraseña</button>' +
      '<a class="link" href="' + waLink('Hola, quiero acceso al dashboard de caja.') + '" target="_blank" rel="noopener">¿No tenés acceso? Escribinos</a>' +
      '</form></div>';
    $('#lf').onsubmit = async function (e) {
      e.preventDefault(); $('#lerr').textContent = '';
      var b = $('button[type=submit]', this); b.disabled = true;
      var r = await sb.auth.signInWithPassword({ email: $('#le').value.trim(), password: $('#lp').value });
      b.disabled = false;
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
    app.innerHTML = '<div class="auth"><form class="auth-card" id="pf"><div class="brand">' + MARK + esc(CFG.marca || 'PanelPro') + '</div>' +
      '<h1>Creá tu contraseña</h1><p class="muted">Mínimo 8 caracteres. La vas a usar para entrar a tu dashboard.</p>' +
      '<label class="field">Contraseña nueva<input id="p1" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<label class="field">Repetila<input id="p2" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<button class="btn pri" type="submit">Guardar y entrar</button><p class="err" id="perr" role="alert"></p></form></div>';
    $('#pf').onsubmit = async function (e) {
      e.preventDefault();
      if ($('#p1').value !== $('#p2').value) { $('#perr').textContent = 'Las contraseñas no coinciden.'; return; }
      var r = await sb.auth.updateUser({ password: $('#p1').value });
      if (r.error) { $('#perr').textContent = 'No se pudo guardar. Probá con otra contraseña.'; return; }
      history.replaceState(null, '', location.pathname);
      toast('Contraseña guardada'); loadMe();
    };
  }

  function renderMessage(title, text) {
    app.innerHTML = '<div class="auth"><div class="auth-card"><div class="brand">' + MARK + esc(CFG.marca || 'PanelPro') + '</div><h1>' + esc(title) + '</h1><p class="muted">' + esc(text) + '</p>' +
      '<a class="btn ok" href="' + waLink() + '" target="_blank" rel="noopener">' + I.wa + ' Escribir por WhatsApp</a><button class="link" id="out">Cerrar sesión</button></div></div>';
    $('#out').onclick = logout;
  }

  async function logout() { if (sb) await sb.auth.signOut(); S.me = null; renderLogin(); }

  // ------------------------------------------------------------ períodos
  function range() {
    var t = today(), a, b = t;
    if (S.period === 'hoy') a = t;
    else if (S.period === '7') a = addDays(t, -6);
    else if (S.period === '30') a = addDays(t, -29);
    else if (S.period === 'mes') a = t.slice(0, 8) + '01';
    else { a = S.from || addDays(t, -29); b = S.to || t; if (a > b) { var x = a; a = b; b = x; } }
    var len = days(a, b).length;
    return { a: a, b: b, pa: addDays(a, -len), pb: addDays(a, -1), len: len };
  }
  function inRange(a, b) { return S.regs.filter(function (r) { return r.fecha >= a && r.fecha <= b; }); }
  function sum(list, f) { return list.reduce(function (s, r) { return s + f(r); }, 0); }
  function totals(list) {
    var t = { ingresos: sum(list, function (r) { return n(r.ingresos); }), gastos: sum(list, gastos), neta: sum(list, neta), dias: list.length,
      nuevos: sum(list, function (r) { return n(r.jugadores_nuevos); }), recurrentes: sum(list, function (r) { return n(r.jugadores_recurrentes); }),
      jmeta: sum(list, function (r) { return n(r.jugadores_meta); }), cargas: sum(list, function (r) { return n(r.cargas_atribuidas); }) };
    GASTOS.forEach(function (g) { t[g[0]] = sum(list, function (r) { return n(r[g[0]]); }); });
    t.margen = t.ingresos ? t.neta / t.ingresos * 100 : 0;
    t.roas = t.meta_ads ? t.cargas / t.meta_ads : 0;
    return t;
  }
  function deltaPct(cur, prev) { if (!prev) return null; return (cur - prev) / Math.abs(prev) * 100; }

  // ------------------------------------------------------------ gráficos (SVG)
  function sparkPath(vals, w, h) {
    if (vals.length < 2) return '';
    var pos = vals.filter(function (v) { return v > 0; });
    var cap = Math.max(median(pos) * 3, 1);
    var max = Math.min(Math.max.apply(null, vals), cap), min = Math.min(0, Math.min.apply(null, vals));
    var span = (max - min) || 1;
    return vals.map(function (v, i) { var x = i / (vals.length - 1) * w, y = h - 3 - (Math.min(v, cap) - min) / span * (h - 6); return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }).join(' ');
  }
  function spark(vals, color) {
    var d = sparkPath(vals, 130, 44);
    if (!d) return '<svg class="spark"></svg>';
    return '<svg class="spark" viewBox="0 0 130 44" aria-hidden="true"><path d="' + d + ' L130 44 L0 44 Z" fill="' + color + '" opacity=".12"/><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function niceMax(v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  function lineChart(dayList, series, opts) {
    var W = 720, H = 280, L = 54, R = 12, T = 12, B = 30, iw = W - L - R, ih = H - T - B;
    var all = []; series.forEach(function (s) { s.vals.forEach(function (v) { if (v != null) all.push(v); }); });
    var max = niceMax(Math.max.apply(null, all.concat([1]))), min = Math.min(0, Math.min.apply(null, all.concat([0])));
    if (min < 0) min = -niceMax(-min);
    var span = max - min;
    function X(i) { return L + (dayList.length < 2 ? iw / 2 : i / (dayList.length - 1) * iw); }
    function Y(v) { return T + ih - (v - min) / span * ih; }
    var g = '';
    for (var k = 0; k <= 4; k++) { var v = min + span * k / 4; g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="#1e2838" stroke-dasharray="4 5"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + money(v) + '</text>'; }
    var step = Math.max(1, Math.ceil(dayList.length / 6));
    dayList.forEach(function (d, i) { if (i % step === 0 || (i === dayList.length - 1 && i % step > step / 2)) g += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + short(d) + '</text>'; });
    series.forEach(function (s) {
      var d = '', on = false;
      s.vals.forEach(function (v, i) { if (v == null) { on = false; return; } d += (on ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); on = true; });
      g += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.w || 2.2) + '" stroke-linejoin="round" stroke-linecap="round"' + (s.dash ? ' stroke-dasharray="6 6"' : '') + '/>';
    });
    if (opts && opts.goal) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(opts.goal).toFixed(1) + '" y2="' + Y(opts.goal).toFixed(1) + '" stroke="#f5c451" stroke-dasharray="3 5"/>';
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts && opts.label || 'Gráfico') + '">' + g + '</svg>';
  }
  function barChart(dayList, stacks, opts) {
    var W = 720, H = 240, L = 54, R = 12, T = 12, B = 30, iw = W - L - R, ih = H - T - B;
    var tots = dayList.map(function (_, i) { return stacks.reduce(function (s, st) { return s + Math.max(0, st.vals[i] || 0); }, 0); });
    var negs = dayList.map(function (_, i) { return stacks.reduce(function (s, st) { return s + Math.min(0, st.vals[i] || 0); }, 0); });
    var max = niceMax(Math.max.apply(null, tots.concat([opts && opts.goal || 0, 1]))), minv = Math.min.apply(null, negs.concat([0]));
    var min = minv < 0 ? -niceMax(-minv) : 0, span = max - min;
    function Y(v) { return T + ih - (v - min) / span * ih; }
    var bw = Math.max(3, Math.min(26, iw / dayList.length * 0.62)), g = '';
    for (var k = 0; k <= 4; k++) { var v = min + span * k / 4; g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="#1e2838" stroke-dasharray="4 5"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + (opts && opts.money ? money(v) : fmtN(v)) + '</text>'; }
    var step = Math.max(1, Math.ceil(dayList.length / 6));
    dayList.forEach(function (d, i) {
      var cx = L + (i + 0.5) / dayList.length * iw, y0 = Y(0), acc = 0;
      stacks.forEach(function (st) {
        var v = st.vals[i] || 0; if (!v) return;
        var col = typeof st.color === 'function' ? st.color(v, i) : st.color;
        if (v > 0) { var y1 = Y(acc + v), y2 = Y(acc); g += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, y2 - y1).toFixed(1) + '" rx="' + Math.min(4, bw / 3).toFixed(1) + '" fill="' + col + '"/>'; acc += v; }
        else { g += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, Y(v) - y0).toFixed(1) + '" rx="' + Math.min(4, bw / 3).toFixed(1) + '" fill="' + col + '"/>'; }
      });
      if (i % step === 0 || (i === dayList.length - 1 && i % step > step / 2)) g += '<text x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + short(d) + '</text>';
    });
    if (opts && opts.goal) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(opts.goal).toFixed(1) + '" y2="' + Y(opts.goal).toFixed(1) + '" stroke="#f5c451" stroke-width="1.5" stroke-dasharray="5 5"/>';
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts && opts.label || 'Gráfico') + '">' + g + '</svg>';
  }
  function donut(parts) {
    var tot = parts.reduce(function (s, p) { return s + p.v; }, 0) || 1, a = -Math.PI / 2, R = 92, r = 64, g = '';
    parts.forEach(function (p) {
      if (!p.v) return;
      var b = a + p.v / tot * Math.PI * 2 - 0.02, large = b - a > Math.PI ? 1 : 0;
      function P(rad, ang) { return (105 + rad * Math.cos(ang)).toFixed(2) + ' ' + (105 + rad * Math.sin(ang)).toFixed(2); }
      g += '<path d="M' + P(R, a) + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + P(R, b) + ' L' + P(r, b) + ' A' + r + ' ' + r + ' 0 ' + large + ' 0 ' + P(r, a) + ' Z" fill="' + p.c + '"/>';
      a = b + 0.02;
    });
    return '<svg viewBox="0 0 210 210" width="210" height="210" aria-hidden="true">' + g + '</svg>';
  }

  // ------------------------------------------------------------ cálculos de negocio
  function robustPace(list) {
    var last = list.slice(-7).map(neta);
    if (!last.length) return 0;
    var med = median(last.map(Math.abs));
    var keep = last.filter(function (v) { return !(med > 0 && Math.abs(v) > med * 3); });
    if (!keep.length) keep = last;
    return keep.reduce(function (s, v) { return s + v; }, 0) / keep.length;
  }
  function health(t, list, goal) {
    var margen = Math.max(0, Math.min(100, t.margen / 40 * 100));
    var met = goal ? list.filter(function (r) { return neta(r) >= goal; }).length : 0;
    var objetivo = goal && list.length ? met / list.length * 100 : 50;
    var roas = Math.max(0, Math.min(100, t.roas / 5 * 100));
    var l7 = sum(S.regs.slice(-7), neta), p7 = sum(S.regs.slice(-14, -7), neta);
    var tend = p7 > 0 ? Math.max(0, Math.min(100, 50 + (l7 - p7) / p7 * 100)) : (l7 > 0 ? 100 : 0);
    var score = Math.round((margen + objetivo + roas + tend) / 4);
    return { score: score, margen: Math.round(margen), objetivo: Math.round(objetivo), roas: Math.round(roas), tend: Math.round(tend) };
  }
  function insights(list, prev, goal) {
    var out = [];
    if (!list.length) return out;
    var best = list.reduce(function (a, r) { return neta(r) > neta(a) ? r : a; });
    out.push(['g', '↗', 'Mejor día: <b>' + short(best.fecha) + '</b>, con <b>' + full(neta(best)) + '</b> de ganancia neta.']);
    var withAds = list.filter(function (r) { return n(r.meta_ads) > 0 && n(r.cargas_atribuidas) > 0; });
    if (withAds.length) { var br = withAds.reduce(function (a, r) { return n(r.cargas_atribuidas) / n(r.meta_ads) > n(a.cargas_atribuidas) / n(a.meta_ads) ? r : a; }); out.push(['v', '★', 'Mejor ROAS: <b>' + fmtN(n(br.cargas_atribuidas) / n(br.meta_ads), 2) + '×</b> el ' + short(br.fecha) + ' (' + full(br.cargas_atribuidas) + ' atribuidos sobre ' + full(br.meta_ads) + ' de inversión).']); }
    if (goal) { var met = list.filter(function (r) { return neta(r) >= goal; }).length; out.push([met / list.length >= 0.5 ? 'g' : 'r', '◎', 'Objetivo diario cumplido en <b>' + met + ' de ' + list.length + '</b> días (' + pct(met / list.length * 100, 0) + ').']); }
    var losses = list.filter(function (r) { return neta(r) < 0; }).length;
    if (losses) out.push(['r', '↘', '<b>' + losses + (losses === 1 ? ' día' : ' días') + '</b> con pérdida en el período.']);
    if (prev.length) {
      var tc = totals(list), tp = totals(prev), worst = null;
      GASTOS.forEach(function (gg) { var d = deltaPct(tc[gg[0]], tp[gg[0]]); if (d != null && (!worst || d > worst.d)) worst = { name: gg[1], d: d, c: tc[gg[0]], p: tp[gg[0]] }; });
      if (worst && worst.d > 0) out.push(['r', '!', 'El gasto que más creció fue <b>' + worst.name.toLowerCase() + '</b>: +' + pct(worst.d) + ' (' + full(worst.c) + ' vs ' + full(worst.p) + ').']);
    }
    return out;
  }

  // ------------------------------------------------------------ tablero
  function kpi(c, icon, label, val, d, good, vals, color, unit) {
    var cls = d == null || Math.abs(d) < 0.05 ? 'flat' : ((d > 0) === good ? 'good' : 'bad');
    var txt = d == null ? 'sin datos previos' : (d > 0 ? '↗ +' : '↘ ') + fmtN(d, 1) + (unit || '%');
    return '<article class="card kpi" style="--c:' + c + '"><div class="ch"><span class="ico">' + icon + '</span><span class="lbl">' + label + '</span></div>' +
      '<div class="val">' + val + '</div><div class="row"><div><span class="delta ' + cls + '">' + txt + '</span><div class="vs">vs. período anterior</div></div>' + spark(vals, color) + '</div></article>';
  }

  function renderDash() {
    var rg = range(), list = inRange(rg.a, rg.b), prev = inRange(rg.pa, rg.pb), t = totals(list), tp = totals(prev);
    var goal = n(S.viewing.objetivo_diario), dayList = days(rg.a, rg.b), byDay = {};
    list.forEach(function (r) { byDay[r.fecha] = r; });
    var seriesOf = function (f) { return dayList.map(function (d) { return byDay[d] ? f(byDay[d]) : 0; }); };
    var isAdmin = S.me.rol === 'admin', hasData = S.regs.length > 0;
    var periods = [['hoy', 'Hoy'], ['7', '7 días'], ['30', '30 días'], ['mes', 'Este mes'], ['custom', 'Personalizado']];
    var h = '<div class="wrap">';
    h += '<div class="top"><div class="brand">' + MARK + esc(CFG.marca || 'PanelPro') + '</div><div class="who">' +
      (DEMO ? '<span class="chip demo">Demo</span>' : '') + (isAdmin ? '<span class="chip admin">Admin</span><button class="btn sm" id="back">← Clientes</button>' : '') +
      '<span>' + esc(S.me.email) + '</span><button class="btn sm" id="cfg" title="Ajustes">' + I.gear + '</button>' + (DEMO ? '' : '<button class="btn sm" id="out">Salir</button>') + '</div></div>';
    h += '<div class="head"><div><span class="lbl">Resumen financiero</span><h1>Dashboard de ' + esc(S.viewing.nombre || S.viewing.email) + '</h1><p class="range">' + (rg.a === rg.b ? longD(rg.a) : short(rg.a) + ' — ' + longD(rg.b)) + '</p></div>' +
      '<div class="actions"><button class="btn" id="exp">' + I.dl + ' Exportar reporte</button></div></div>';
    h += '<div class="periods" role="group" aria-label="Período">' + periods.map(function (p) { return '<button type="button" data-p="' + p[0] + '" aria-pressed="' + (S.period === p[0]) + '">' + p[1] + '</button>'; }).join('') +
      (S.period === 'custom' ? '<span class="custom"><input type="date" id="cf" value="' + (S.from || rg.a) + '" max="' + today() + '"> a <input type="date" id="ct" value="' + (S.to || rg.b) + '" max="' + today() + '"></span>' : '') + '</div>';

    if (!hasData) {
      h += '<div class="card empty" style="--c:var(--green)"><span class="ico" style="--c:var(--green)">' + I.plus + '</span><h2>Cargá tu primer día para ver tu dashboard</h2><p class="muted">Ingresos, gastos y jugadores de un día. Con eso ya ves tu ganancia neta y tu margen.</p><button class="btn pri" id="first">' + I.plus + ' Cargar día</button></div>';
    } else {
      h += '<section class="kpis">' +
        kpi('var(--green)', I.wallet, 'Ganancia neta', money(t.neta), deltaPct(t.neta, tp.neta), true, seriesOf(neta), '#2ee59d') +
        kpi('var(--blue)', I.up, 'Ingresos', money(t.ingresos), deltaPct(t.ingresos, tp.ingresos), true, seriesOf(function (r) { return n(r.ingresos); }), '#6e9cff') +
        kpi('var(--red)', I.receipt, 'Gastos totales', money(t.gastos), deltaPct(t.gastos, tp.gastos), false, seriesOf(gastos), '#ff6b6b') +
        kpi('var(--violet)', I.pct, 'Margen neto', pct(t.margen), prev.length ? t.margen - tp.margen : null, true, seriesOf(function (r) { return n(r.ingresos) ? neta(r) / n(r.ingresos) * 100 : 0; }), '#b18cff', 'pp') +
        kpi('var(--cyan)', I.mega, 'Meta Ads', money(t.meta_ads), deltaPct(t.meta_ads, tp.meta_ads), false, seriesOf(function (r) { return n(r.meta_ads); }), '#38d9f0') +
        kpi('var(--amber)', I.trophy, 'Premios pagados', money(t.premios), deltaPct(t.premios, tp.premios), false, seriesOf(function (r) { return n(r.premios); }), '#fbbf24') +
        kpi('var(--pink)', I.chips, 'Fichas', money(t.fichas), deltaPct(t.fichas, tp.fichas), false, seriesOf(function (r) { return n(r.fichas); }), '#f472b6') +
        kpi('var(--teal)', I.receipt, 'Comisiones', money(t.comisiones), deltaPct(t.comisiones, tp.comisiones), false, seriesOf(function (r) { return n(r.comisiones); }), '#2dd4bf') +
        '</section>';

      // objetivo + resumen
      var metaPer = goal * list.length, cumpl = metaPer ? t.neta / metaPer * 100 : 0, C = 2 * Math.PI * 58;
      var ins = insights(list, prev, goal);
      h += '<section class="grid2">';
      h += '<article class="card" style="--c:var(--green)"><div class="ch"><span class="ico">' + I.target + '</span><div><h2>Objetivo diario</h2><p class="sub">Ganancia neta del período vs. tu meta</p></div></div>' +
        (goal ? '<div class="goal"><div class="ring"><svg viewBox="0 0 140 140"><circle cx="70" cy="70" r="58" fill="none" stroke="#1e2838" stroke-width="12"/><circle cx="70" cy="70" r="58" fill="none" stroke="url(#gr)" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (C * Math.min(1, Math.max(0, cumpl / 100))).toFixed(1) + ' ' + C.toFixed(1) + '"/><defs><linearGradient id="gr"><stop offset="0" stop-color="#2ee59d"/><stop offset="1" stop-color="#38d9f0"/></linearGradient></defs></svg><b>' + pct(cumpl, 0) + '</b></div>' +
          '<div><span class="lbl">Cumplido del período</span><div class="big">' + money(t.neta) + '</div><p class="muted">Meta ' + money(metaPer) + ' (' + full(goal) + ' × ' + list.length + ' días)</p>' +
          '<p style="margin-top:6px;font-weight:700;color:' + (t.neta >= metaPer ? 'var(--green)' : 'var(--red)') + '">' + (t.neta >= metaPer ? 'Superado por ' : 'Faltan ') + money(Math.abs(t.neta - metaPer)) + '</p></div></div>'
          : '<p class="muted" style="margin-top:14px">Todavía no cargaste tu objetivo diario. <button class="link" id="setgoal">Cargarlo ahora</button></p>') + '</article>';
      h += '<article class="card" style="--c:var(--violet)"><div class="ch"><span class="ico">' + I.spark + '</span><div><h2>Resumen inteligente</h2><p class="sub">Lecturas automáticas del período</p></div></div><ul class="ins">' +
        ins.map(function (x) { return '<li><i class="' + x[0] + '">' + x[1] + '</i><span>' + x[2] + '</span></li>'; }).join('') + '</ul></article>';
      h += '</section>';

      // salud + composición
      var hs = health(t, list, goal), state = hs.score >= 75 ? ['Excelente', 'var(--green)'] : hs.score >= 55 ? ['Bien', 'var(--cyan)'] : hs.score >= 35 ? ['Atención', 'var(--amber)'] : ['Crítico', 'var(--red)'];
      var arcLen = Math.PI * 120;
      h += '<section class="grid2">';
      h += '<article class="card" style="--c:var(--green)"><div class="ch"><span class="ico">' + I.gauge + '</span><div><h2>Salud del negocio</h2><p class="sub">Margen, objetivo, ROAS y tendencia</p></div></div>' +
        '<div class="gauge"><svg viewBox="0 0 300 170"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#ff6b6b"/><stop offset=".5" stop-color="#fbbf24"/><stop offset="1" stop-color="#2ee59d"/></linearGradient></defs>' +
        '<path d="M30 150 A120 120 0 0 1 270 150" fill="none" stroke="#1e2838" stroke-width="20" stroke-linecap="round"/>' +
        '<path d="M30 150 A120 120 0 0 1 270 150" fill="none" stroke="url(#gg)" stroke-width="20" stroke-linecap="round" stroke-dasharray="' + (arcLen * hs.score / 100).toFixed(1) + ' ' + arcLen.toFixed(1) + '"/></svg>' +
        '<div class="score"><b>' + hs.score + '</b><span>/ 100</span><em style="color:' + state[1] + '">' + state[0] + '</em></div></div>' +
        '<div class="subs"><div>Margen <b>' + hs.margen + '</b></div><div>Objetivo <b>' + hs.objetivo + '</b></div><div>ROAS <b>' + hs.roas + '</b></div><div>Tendencia <b>' + hs.tend + '</b></div></div></article>';
      var parts = GASTOS.map(function (g) { return { k: g[1], v: t[g[0]], c: g[3] }; }).filter(function (p) { return p.v > 0; }).sort(function (a, b) { return b.v - a.v; });
      h += '<article class="card" style="--c:var(--violet)"><div class="ch"><span class="ico">' + I.pie + '</span><div><h2>Composición de gastos</h2><p class="sub">En qué se va cada peso de gasto</p></div></div>' +
        '<div class="donut"><div class="pie">' + donut(parts) + '<b><small>TOTAL GASTOS</small>' + money(t.gastos) + '</b></div><div class="rows">' +
        parts.map(function (p) { return '<div style="--dot:' + p.c + '"><i></i><span>' + p.k + '</span><b>' + money(p.v) + '</b><em>' + pct(t.gastos ? p.v / t.gastos * 100 : 0) + '</em></div>'; }).join('') + '</div></div></article>';
      h += '</section>';

      // evolución
      var proj = null, extDays = dayList.slice();
      var monthEnd = (function () { var d = parse(rg.b); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); })();
      if ((S.period === 'mes' || S.period === '30') && rg.b === today() && monthEnd > rg.b) {
        var pace = robustPace(S.regs); var more = days(addDays(rg.b, 1), monthEnd); extDays = dayList.concat(more);
        proj = extDays.map(function (d, i) { return i < dayList.length - 1 ? null : (i === dayList.length - 1 ? (byDay[d] ? neta(byDay[d]) : pace) : pace); });
      }
      var pad = function (arr) { return arr.concat(new Array(extDays.length - arr.length).fill(null)); };
      var ser = [{ vals: pad(seriesOf(function (r) { return n(r.ingresos); })), color: '#2ee59d' }, { vals: pad(seriesOf(gastos)), color: '#ff6b6b' }, { vals: pad(seriesOf(neta)), color: '#38d9f0', w: 2.6 }];
      if (proj) ser.push({ vals: proj, color: '#b18cff', dash: true });
      if (S.compare && prev.length) { var pmap = {}; prev.forEach(function (r) { pmap[r.fecha] = r; }); ser.push({ vals: pad(days(rg.pa, rg.pb).map(function (d) { return pmap[d] ? neta(pmap[d]) : null; })), color: '#6f7a8c', dash: true, w: 1.6 }); }
      h += '<section class="grid2"><article class="card wide" style="--c:var(--green)"><div class="ch"><span class="ico">' + I.up + '</span><div><h2>Ingresos vs gastos vs ganancia neta</h2><p class="sub">Evolución diaria del período</p></div></div>' +
        '<div class="legend"><span style="--dot:#2ee59d">Ingresos</span><span style="--dot:#ff6b6b">Gastos</span><span style="--dot:#38d9f0">Ganancia neta</span>' + (proj ? '<span style="--dot:#b18cff">Proyección</span>' : '') + (S.compare ? '<span style="--dot:#6f7a8c">Período anterior (ganancia)</span>' : '') + '</div>' +
        '<button class="toggle" id="cmp" aria-pressed="' + S.compare + '">Comparar con el período anterior</button>' + lineChart(extDays, ser, { label: 'Evolución diaria' }) + '</article></section>';

      // meta + jugadores
      var cpj = t.jmeta ? t.meta_ads / t.jmeta : 0, vpj = t.jmeta ? t.cargas / t.jmeta : 0, ticket = (t.nuevos + t.recurrentes) ? t.ingresos / (t.nuevos + t.recurrentes) : 0;
      h += '<section class="grid2">';
      h += '<article class="card" style="--c:var(--cyan)"><div class="ch"><span class="ico">' + I.funnel + '</span><div><h2>Rendimiento de Meta Ads</h2><p class="sub">De la inversión a las cargas atribuidas</p></div></div>' +
        '<div class="tiles"><div class="tile"><small class="lbl">Inversión</small><b>' + money(t.meta_ads) + '</b><small>' + full(t.meta_ads) + '</small></div><div class="tile"><small class="lbl">Cargas atribuidas</small><b>' + money(t.cargas) + '</b><small>' + full(t.cargas) + '</small></div>' +
        '<div class="tile"><small class="lbl">ROAS</small><b>' + fmtN(t.roas, 2) + '×</b><small>cargas por cada peso invertido</small></div><div class="tile"><small class="lbl">Costo por jugador</small><b>' + money(cpj) + '</b><small>' + fmtN(t.jmeta) + ' jugadores desde Meta</small></div></div>' +
        '<div class="funnel"><div class="step"><span>Inversión</span><b>' + full(t.meta_ads) + '</b></div><div class="bar"><i style="width:100%;--a:#38d9f0;--b:#2b6c86"></i></div>' +
        '<div class="step"><span>Jugadores desde Meta</span><b>' + fmtN(t.jmeta) + '</b></div><div class="bar"><i style="width:' + (t.jmeta ? 70 : 0) + '%;--a:#38d9f0;--b:#6e6bff"></i></div>' +
        '<div class="step"><span>Cargas atribuidas</span><b>' + full(t.cargas) + '</b></div><div class="bar"><i style="width:' + (t.cargas ? Math.min(100, Math.max(8, t.roas / Math.max(t.roas, 1) * 50)) : 0) + '%;--a:#b18cff;--b:#7a4fe0"></i></div>' +
        '<p class="conv">Valor por jugador ' + full(vpj) + '</p></div></article>';
      h += '<article class="card" style="--c:var(--amber)"><div class="ch"><span class="ico">' + I.users + '</span><div><h2>Jugadores</h2><p class="sub">Nuevos y recurrentes por día</p></div></div>' +
        '<div class="legend"><span style="--dot:#38d9f0">Nuevos ' + fmtN(t.nuevos) + '</span><span style="--dot:#8b87ff">Recurrentes ' + fmtN(t.recurrentes) + '</span></div>' +
        barChart(dayList, [{ vals: seriesOf(function (r) { return n(r.jugadores_nuevos); }), color: '#38d9f0' }, { vals: seriesOf(function (r) { return n(r.jugadores_recurrentes); }), color: '#8b87ff' }], { label: 'Jugadores por día' }) +
        '<div class="tiles"><div class="tile"><small class="lbl">Ticket promedio</small><b>' + full(ticket) + '</b></div><div class="tile"><small class="lbl">Jugadores totales</small><b>' + fmtN(t.nuevos + t.recurrentes) + '</b></div></div></article>';
      h += '</section>';

      // objetivo por día + proyección
      var monthStart = today().slice(0, 8) + '01', mList = inRange(monthStart, today()), mAcc = sum(mList, neta);
      var dim = new Date(parse(today()).getFullYear(), parse(today()).getMonth() + 1, 0).getDate(), left = dim - parse(today()).getDate();
      var pace2 = robustPace(S.regs), closing = mAcc + pace2 * left, mGoal = goal * dim;
      var met = goal ? list.filter(function (r) { return neta(r) >= goal; }).length : 0;
      h += '<section class="grid2">';
      h += '<article class="card" style="--c:var(--green)"><div class="ch"><span class="ico">' + I.target + '</span><div><h2>Objetivo por día</h2><p class="sub">Ganancia neta diaria vs. tu meta</p></div></div>' +
        (goal ? '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:14px"><span class="lbl">Días cumplidos</span><b style="color:var(--green)">' + pct(list.length ? met / list.length * 100 : 0, 0) + '</b></div><div style="font:800 26px var(--f)">' + met + ' / ' + list.length + '</div>' : '') +
        barChart(dayList, [{ vals: seriesOf(neta), color: function (v) { return v < 0 ? '#ff6b6b' : (goal && v >= goal ? '#2ee59d' : '#4b5a72'); } }], { goal: goal, money: true, label: 'Ganancia neta por día' }) + '</article>';
      h += '<article class="card" style="--c:var(--cyan)"><div class="ch"><span class="ico">' + I.cal + '</span><div><h2>Proyección del mes</h2><p class="sub">Cierre estimado de ganancia neta con el ritmo reciente</p></div></div>' +
        '<div style="font:800 40px/1.1 var(--f);margin-top:16px" class="num">' + money(closing) + '</div><p class="muted">Faltan ' + left + ' días · ritmo de ' + full(pace2) + ' por día (sin contar días atípicos)</p>' +
        (goal ? '<div style="display:flex;justify-content:space-between;margin-top:16px;font-size:14px;color:var(--text2)"><span>Meta mensual ' + money(mGoal) + '</span><b style="color:var(--green)">' + pct(mGoal ? closing / mGoal * 100 : 0, 0) + '</b></div><div class="prog"><i style="width:' + Math.min(100, mGoal ? closing / mGoal * 100 : 0).toFixed(1) + '%"></i></div>' : '') +
        '<p class="muted" style="margin-top:10px">Acumulado del mes: <b class="num" style="color:var(--text)">' + full(mAcc) + '</b></p></article>';
      h += '</section>';

      // calendario + hall of fame
      var mDays = days(monthStart, iso(new Date(parse(today()).getFullYear(), parse(today()).getMonth() + 1, 0)));
      var allN = {}; S.regs.forEach(function (r) { allN[r.fecha] = neta(r); });
      var posVals = mDays.map(function (d) { return allN[d]; }).filter(function (v) { return v > 0; }), mx = Math.max.apply(null, posVals.concat([1]));
      var offset = (parse(monthStart).getDay() + 6) % 7, cal = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(function (x) { return '<div class="dw">' + x + '</div>'; }).join('');
      for (var o = 0; o < offset; o++) cal += '<i class="pad"></i>';
      mDays.forEach(function (d) {
        var v = allN[d], cls = 'd', st = '';
        if (v != null && v < 0) cls += ' loss';
        else if (v != null) { var a = 0.15 + 0.75 * Math.sqrt(v / mx); st = ' style="background:rgba(46,229,157,' + a.toFixed(2) + ');color:' + (a > .5 ? '#052016' : 'var(--text)') + '"'; }
        if (goal && v != null && v >= goal) cls += ' hit';
        if (d === today()) cls += ' today';
        cal += '<div class="' + cls + '"' + st + ' title="' + short(d) + (v != null ? ': ' + full(v) : ': sin datos') + '">' + parse(d).getDate() + '</div>';
      });
      var bestN = S.regs.reduce(function (a, r) { return !a || neta(r) > neta(a) ? r : a; }, null);
      var bestM = S.regs.filter(function (r) { return n(r.ingresos) > 0; }).reduce(function (a, r) { return !a || neta(r) / n(r.ingresos) > neta(a) / n(a.ingresos) ? r : a; }, null);
      var bestJ = S.regs.reduce(function (a, r) { var x = n(r.jugadores_nuevos) + n(r.jugadores_recurrentes); return !a || x > n(a.jugadores_nuevos) + n(a.jugadores_recurrentes) ? r : a; }, null);
      var streak = 0; if (goal) { for (var z = S.regs.length - 1; z >= 0 && neta(S.regs[z]) >= goal; z--) streak++; }
      var lastR = S.regs[S.regs.length - 1], isRecord = bestN && lastR && bestN.fecha === lastR.fecha && S.regs.length > 3;
      h += '<section class="grid2">';
      h += '<article class="card" style="--c:var(--green)"><div class="ch"><span class="ico">' + I.cal + '</span><div><h2>Mapa de calor del mes</h2><p class="sub">Ganancia neta por día · ' + MESL[parse(today()).getMonth()] + '</p></div></div><div class="cal">' + cal + '</div>' +
        '<div class="legend"><span style="--dot:rgba(46,229,157,.9)">Más ganancia</span><span style="--dot:rgba(255,107,107,.7)">Pérdida</span><span style="--dot:var(--gold)">Objetivo cumplido</span></div></article>';
      h += '<article class="card" style="--c:var(--amber)"><div class="ch"><span class="ico">' + I.award + '</span><div><h2>Hall of fame</h2><p class="sub">Récords históricos y racha activa</p></div></div>' +
        (isRecord ? '<div class="record">★ <span>Tu último día cargado es tu mejor día histórico en ganancia neta.</span></div>' : '') +
        '<div class="fame"><div class="tile"><small class="lbl">Mejor ganancia</small><b>' + (bestN ? full(neta(bestN)) : '—') + '</b><small>' + (bestN ? short(bestN.fecha) : '') + '</small></div>' +
        '<div class="tile"><small class="lbl">Mejor margen</small><b>' + (bestM ? pct(neta(bestM) / n(bestM.ingresos) * 100) : '—') + '</b><small>' + (bestM ? short(bestM.fecha) : '') + '</small></div>' +
        '<div class="tile"><small class="lbl">Más jugadores</small><b>' + (bestJ ? fmtN(n(bestJ.jugadores_nuevos) + n(bestJ.jugadores_recurrentes)) : '—') + '</b><small>' + (bestJ ? short(bestJ.fecha) : '') + '</small></div>' +
        '<div class="tile"><small class="lbl">Racha de objetivo</small><b>' + streak + (streak === 1 ? ' día' : ' días') + '</b><small>' + (goal ? 'seguidos cumpliendo' : 'cargá tu objetivo') + '</small></div></div></article>';
      h += '</section>';

      // últimos movimientos
      var lastRegs = S.regs.slice(-7).reverse();
      h += '<section class="grid2"><article class="card wide" style="--c:var(--blue)"><div class="ch"><span class="ico">' + I.list + '</span><div><h2>Últimos movimientos</h2><p class="sub">Los últimos 7 días cargados</p></div></div><div class="moves">' +
        lastRegs.map(function (r) { var nt = neta(r); return '<div class="move"><span class="date">' + short(r.fecha) + '</span><div><small>Ingresos</small><b>' + full(r.ingresos) + '</b></div><div><small>Gastos</small><b>' + full(gastos(r)) + '</b></div><div><small>Ganancia</small><b style="color:' + (nt < 0 ? 'var(--red)' : 'var(--green)') + '">' + full(nt) + '</b></div><button class="btn sm edit" data-edit="' + r.fecha + '">Editar</button></div>'; }).join('') +
        '</div></article></section>';
    }
    h += '<p class="watermark">Dashboard de uso exclusivo de ' + esc(S.viewing.nombre || S.viewing.email) + ' · ' + esc(CFG.marca || 'PanelPro') + '</p></div>';
    h += '<button class="btn pri fab" id="add">' + I.plus + ' Cargar día</button>';
    if (CFG.whatsapp) h += '<a class="btn wa" href="' + waLink() + '" target="_blank" rel="noopener">' + I.wa + ' Hablar con mi asesor</a>';
    app.innerHTML = h;
    bindDash();
  }

  function bindDash() {
    $$('[data-p]').forEach(function (b) { b.onclick = function () { S.period = b.dataset.p; renderDash(); }; });
    if ($('#cf')) { $('#cf').onchange = function () { S.from = this.value; renderDash(); }; $('#ct').onchange = function () { S.to = this.value; renderDash(); }; }
    if ($('#cmp')) $('#cmp').onclick = function () { S.compare = !S.compare; renderDash(); };
    if ($('#exp')) $('#exp').onclick = function () { window.print(); };
    if ($('#out')) $('#out').onclick = logout;
    if ($('#back')) $('#back').onclick = function () { renderAdmin(); };
    $('#add').onclick = function () { openDay(today()); };
    if ($('#first')) $('#first').onclick = function () { openDay(today()); };
    if ($('#cfg')) $('#cfg').onclick = openSettings;
    if ($('#setgoal')) $('#setgoal').onclick = openSettings;
    $$('[data-edit]').forEach(function (b) { b.onclick = function () { openDay(b.dataset.edit); }; });
  }

  // ------------------------------------------------------------ carga de un día
  var FIELDS = [['ingresos', 'Ingresos del día', 1], ['premios', 'Premios pagados', 1], ['fichas', 'Compra de fichas', 1], ['meta_ads', 'Inversión en Meta Ads', 1], ['comisiones', 'Comisiones', 1], ['otros_gastos', 'Otros gastos', 1],
    ['jugadores_nuevos', 'Jugadores nuevos', 0], ['jugadores_recurrentes', 'Jugadores recurrentes', 0], ['jugadores_meta', 'Jugadores que vinieron de Meta', 0], ['cargas_atribuidas', 'Cargas atribuidas a Meta ($)', 1]];
  function openDay(fecha) {
    var dlg = document.createElement('dialog');
    function rec(f) { return S.regs.find(function (r) { return r.fecha === f; }); }
    function fill(f) {
      var r = rec(f) || {};
      FIELDS.forEach(function (x) { $('#f_' + x[0], dlg).value = r[x[0]] != null && n(r[x[0]]) ? n(r[x[0]]) : ''; });
      $('#fdel', dlg).hidden = !rec(f); $('#ftitle', dlg).textContent = rec(f) ? 'Editar día' : 'Cargar día'; calc();
    }
    function calc() {
      var v = {}; FIELDS.forEach(function (x) { v[x[0]] = n($('#f_' + x[0], dlg).value); });
      $('#fcalc', dlg).innerHTML = '<span>Ganancia neta del día</span><b style="color:' + (neta(v) < 0 ? 'var(--red)' : 'var(--green)') + '">' + full(neta(v)) + '</b>';
    }
    dlg.innerHTML = '<form class="modal" method="dialog" id="df"><h2 id="ftitle">Cargar día</h2>' +
      '<label class="field">Fecha<input type="date" id="f_fecha" value="' + fecha + '" max="' + today() + '" required></label><div class="fgrid">' +
      '<span class="lbl fsec">Ingresos y gastos ($)</span>' +
      FIELDS.slice(0, 6).map(function (x) { return '<label class="field' + (x[0] === 'ingresos' ? ' full' : '') + '">' + x[1] + '<input id="f_' + x[0] + '" inputmode="decimal" type="number" min="0" step="0.01" placeholder="0"></label>'; }).join('') +
      '<span class="lbl fsec">Jugadores y Meta</span>' +
      FIELDS.slice(6).map(function (x) { return '<label class="field">' + x[1] + '<input id="f_' + x[0] + '" inputmode="numeric" type="number" min="0" step="' + (x[2] ? '0.01' : '1') + '" placeholder="0"></label>'; }).join('') +
      '</div><div class="calc" id="fcalc"></div><p class="err" id="ferr"></p><div class="mrow"><button class="btn danger" type="button" id="fdel" hidden>Borrar día</button><button class="btn" type="button" id="fcancel">Cancelar</button><button class="btn pri" type="submit">Guardar</button></div></form>';
    document.body.appendChild(dlg); dlg.showModal(); fill(fecha);
    $('#f_fecha', dlg).onchange = function () { fill(this.value); };
    $$('input[type=number]', dlg).forEach(function (i) { i.oninput = calc; });
    $('#fcancel', dlg).onclick = function () { dlg.close(); };
    dlg.addEventListener('close', function () { dlg.remove(); });
    $('#fdel', dlg).onclick = async function () {
      var f = $('#f_fecha', dlg).value;
      if (this.dataset.sure !== '1') { this.dataset.sure = '1'; this.textContent = '¿Seguro? Tocá de nuevo'; return; }
      if (!DEMO) { var r = await sb.from('registros').delete().eq('user_id', S.viewing.id).eq('fecha', f); if (r.error) { $('#ferr', dlg).textContent = 'No se pudo borrar.'; return; } }
      S.regs = S.regs.filter(function (x) { return x.fecha !== f; }); dlg.close(); toast('Día borrado'); renderDash();
    };
    $('#df', dlg).onsubmit = async function (e) {
      e.preventDefault();
      var f = $('#f_fecha', dlg).value;
      if (!f || f > today()) { $('#ferr', dlg).textContent = 'La fecha no puede ser futura.'; return; }
      var row = { user_id: S.viewing.id, fecha: f, actualizado: new Date().toISOString() }, bad = false;
      FIELDS.forEach(function (x) { var v = n($('#f_' + x[0], dlg).value); if (v < 0) bad = true; row[x[0]] = x[2] ? Math.round(v * 100) / 100 : Math.round(v); });
      if (bad) { $('#ferr', dlg).textContent = 'Los montos no pueden ser negativos.'; return; }
      if (!row.ingresos && !gastos(row)) { $('#ferr', dlg).textContent = 'Cargá al menos los ingresos o algún gasto.'; return; }
      var btn = $('button[type=submit]', dlg); btn.disabled = true;
      if (!DEMO) { var r = await sb.from('registros').upsert(row, { onConflict: 'user_id,fecha' }); btn.disabled = false; if (r.error) { $('#ferr', dlg).textContent = 'No se pudo guardar. Revisá tu conexión.'; return; } }
      S.regs = S.regs.filter(function (x) { return x.fecha !== f; }).concat([row]).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
      dlg.close(); toast('Día guardado'); renderDash();
    };
  }

  function openSettings() {
    var dlg = document.createElement('dialog');
    dlg.innerHTML = '<form class="modal" method="dialog" id="sf"><h2>Ajustes</h2>' +
      '<label class="field">Nombre que se muestra en el dashboard<input id="s_n" value="' + esc(S.viewing.nombre) + '" maxlength="60"></label>' +
      '<label class="field">Objetivo de ganancia neta por día ($)<input id="s_g" type="number" min="0" step="1000" inputmode="numeric" value="' + (n(S.viewing.objetivo_diario) || '') + '"></label>' +
      '<p class="muted" style="font-size:13px">Con este número se calculan el objetivo diario, la meta del mes y la salud del negocio.</p>' +
      '<p class="err" id="serr"></p><div class="mrow"><button class="btn" type="button" id="scancel">Cancelar</button><button class="btn pri" type="submit">Guardar</button></div></form>';
    document.body.appendChild(dlg); dlg.showModal();
    dlg.addEventListener('close', function () { dlg.remove(); });
    $('#scancel', dlg).onclick = function () { dlg.close(); };
    $('#sf', dlg).onsubmit = async function (e) {
      e.preventDefault();
      var upd = { nombre: $('#s_n', dlg).value.trim(), objetivo_diario: Math.max(0, n($('#s_g', dlg).value)) };
      if (!DEMO) { var r = await sb.from('perfiles').update(upd).eq('id', S.viewing.id); if (r.error) { $('#serr', dlg).textContent = 'No se pudo guardar.'; return; } }
      Object.assign(S.viewing, upd); dlg.close(); toast('Ajustes guardados'); renderDash();
    };
  }

  // ------------------------------------------------------------ administración
  var NAV = [['clientes', 'Clientes', '#admin'], ['agencia', 'Agencia', '#agencia'], ['banco', 'Banco creativo', 'creativos.html']];
  function shell(active, right) {
    return '<div class="top"><div class="brand">' + MARK + esc(CFG.marca || 'PanelPro') + '</div>' +
      '<nav class="nav" aria-label="Secciones">' + NAV.map(function (n) { return n[0] === active ? '<span aria-current="page">' + n[1] + '</span>' : '<a href="' + n[2] + '">' + n[1] + '</a>'; }).join('') + '</nav>' +
      '<div class="who">' + (DEMO ? '<span class="chip demo">Demo</span>' : '') + '<span class="chip admin">Admin</span>' + (right || '') + '</div></div>';
  }
  function cur(v, m) { return m === 'ARS' ? full(v) : 'US$ ' + fmtN(Math.round(n(v))); }
  function addMonth(s) { var d = parse(s), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return iso(d); }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
  function waTo(num, text) { var d = String(num || '').replace(/\D/g, ''); return d ? 'https://wa.me/' + d + '?text=' + encodeURIComponent(text) : null; }

  function demoAdmin() {
    var names = [['Norte', 500, 3, 0, '5491100000001'], ['Delta', 700, -2, 1, '5491100000002'], ['Litoral', 500, 12, 5, '5491100000003'], ['Costa', 600, 25, 0, ''], ['Andes', 450, 8, 2, '5491100000005'], ['Centro', 800, 18, 0, '5491100000006']];
    var t = today(), seed = 3;
    function r() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    S.clients = names.map(function (x, i) {
      var series = []; for (var k = 29; k >= 0; k--) { var v = (i === 2 && k < 9) ? -(40000 + r() * 80000) : (250000 + r() * 500000) * (1 + (29 - k) / 60); series.push(k < x[3] ? null : Math.round(v)); }
      return { id: 'd' + i, nombre: x[0], email: x[0].toLowerCase() + '@ejemplo.com', activo: i !== 4, rol: 'cliente', creado: addDays(t, -40 + i * 5),
        _series: series, _neta: series.reduce(function (s, v) { return s + (v || 0); }, 0), _n7: series.slice(-7).reduce(function (s, v) { return s + (v || 0); }, 0), _last: addDays(t, -x[3]),
        _cta: { abono: x[1], moneda: 'USD', proximo_cobro: addDays(t, x[2]), whatsapp: x[4], notas: i === 0 ? 'Quiere sumar campaña de remarketing en diciembre.' : '' } };
    });
    S.pagosMes = [{ user_id: 'd0', monto: 500, moneda: 'USD' }, { user_id: 'd3', monto: 600, moneda: 'USD' }, { user_id: 'd5', monto: 800, moneda: 'USD' }];
  }

  async function renderAdmin() {
    app.innerHTML = '<div class="wrap">' + shell('clientes') + '<p class="muted">Cargando clientes…</p></div>';
    if (DEMO) { demoAdmin(); return drawAdmin(); }
    var since = addDays(today(), -29), mStart = today().slice(0, 8) + '01';
    var res = await Promise.all([
      sb.from('perfiles').select('*').order('creado', { ascending: false }),
      sb.from('registros').select('user_id,fecha,ingresos,premios,fichas,meta_ads,comisiones,otros_gastos').gte('fecha', since).limit(20000),
      sb.from('registros').select('user_id,fecha').order('fecha', { ascending: false }).limit(5000),
      sb.from('cuentas').select('*'),
      sb.from('pagos').select('user_id,monto,moneda,fecha').gte('fecha', mStart),
    ]);
    if (res[0].error) { app.innerHTML = '<div class="wrap">' + shell('clientes') + '<p class="err">No se pudieron cargar los clientes.</p></div>'; return; }
    var noBilling = !!res[3].error;
    var days30 = days(since, today()), byUser = {}, lastBy = {}, ctas = {};
    (res[1].data || []).forEach(function (x) { (byUser[x.user_id] = byUser[x.user_id] || {})[x.fecha] = neta(x); });
    (res[2].data || []).forEach(function (x) { if (!lastBy[x.user_id]) lastBy[x.user_id] = x.fecha; });
    (res[3].data || []).forEach(function (x) { ctas[x.user_id] = x; });
    S.pagosMes = res[4].data || []; S.noBilling = noBilling;
    S.clients = res[0].data.filter(function (c) { return c.rol === 'cliente'; }).map(function (c) {
      var m = byUser[c.id] || {}; c._series = days30.map(function (d) { return m[d] == null ? null : m[d]; });
      c._neta = c._series.reduce(function (s, v) { return s + (v || 0); }, 0); c._n7 = c._series.slice(-7).reduce(function (s, v) { return s + (v || 0); }, 0);
      c._last = lastBy[c.id] || null; c._cta = ctas[c.id] || { abono: 0, moneda: 'USD', proximo_cobro: null, whatsapp: '', notas: '' };
      return c;
    });
    drawAdmin();
  }

  function cobroState(c) {
    var p = c._cta.proximo_cobro; if (!p || !n(c._cta.abono)) return { k: 'none', t: 'Sin abono cargado', d: null };
    var d = daysBetween(today(), p);
    if (d < 0) return { k: 'bad', t: 'Vencido hace ' + (-d) + (d === -1 ? ' día' : ' días'), d: d };
    if (d === 0) return { k: 'warn', t: 'Vence hoy', d: d };
    if (d <= 5) return { k: 'warn', t: 'Vence en ' + d + (d === 1 ? ' día' : ' días'), d: d };
    return { k: 'ok', t: 'Al día · ' + short(p), d: d };
  }
  function actState(c) {
    if (!c._last) return { k: 'none', t: 'Nunca cargó', d: 99 };
    var d = daysBetween(c._last, today());
    if (d <= 1) return { k: 'ok', t: d === 0 ? 'Cargó hoy' : 'Cargó ayer', d: d };
    return { k: d <= 3 ? 'warn' : 'bad', t: 'Sin cargar hace ' + d + ' días', d: d };
  }
  function miniSpark(vals) {
    var v = vals.map(function (x) { return x == null ? null : x; }), real = v.filter(function (x) { return x != null; });
    if (real.length < 2) return '<svg class="mspark" aria-hidden="true"></svg>';
    var max = Math.max.apply(null, real.concat([0])), min = Math.min.apply(null, real.concat([0])), sp = (max - min) || 1, W = 110, H = 32, d = '', on = false;
    v.forEach(function (x, i) { if (x == null) { on = false; return; } d += (on ? 'L' : 'M') + (i / (v.length - 1) * W).toFixed(1) + ' ' + (H - 3 - (x - min) / sp * (H - 6)).toFixed(1); on = true; });
    var z = (H - 3 - (0 - min) / sp * (H - 6)).toFixed(1), bad = real.slice(-7).reduce(function (s, x) { return s + x; }, 0) < 0;
    return '<svg class="mspark" viewBox="0 0 110 32" aria-hidden="true"><line x1="0" x2="110" y1="' + z + '" y2="' + z + '" stroke="var(--line2)" stroke-dasharray="2 3"/><path d="' + d + '" fill="none" stroke="' + (bad ? '#ff6b6b' : '#2ee59d') + '" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function todos() {
    var out = [];
    S.clients.forEach(function (c) {
      if (!c.activo) return;
      var cs = cobroState(c), as = actState(c), wa = c._cta.whatsapp;
      if (cs.k === 'bad') out.push({ p: 0, sev: 'crit', c: c, t: 'Cobro vencido', d: cur(c._cta.abono, c._cta.moneda) + ' · ' + cs.t.toLowerCase(), acts: [['paid', 'Marcar cobrado', 'ok'], wa ? ['wa', 'Recordar pago', '', 'Hola ' + c.nombre + '! Te recuerdo que venció el abono de ' + cur(c._cta.abono, c._cta.moneda) + '. ¿Me pasás el comprobante cuando lo tengas? Gracias!'] : null] });
      else if (cs.k === 'warn') out.push({ p: 2, sev: 'warn', c: c, t: 'Cobro próximo', d: cur(c._cta.abono, c._cta.moneda) + ' · ' + cs.t.toLowerCase(), acts: [['paid', 'Marcar cobrado', ''], wa ? ['wa', 'Avisar', '', 'Hola ' + c.nombre + '! Te aviso que ' + (cs.d === 0 ? 'hoy' : 'en ' + cs.d + (cs.d === 1 ? ' día' : ' días')) + ' vence el abono de ' + cur(c._cta.abono, c._cta.moneda) + '. Gracias!'] : null] });
      if (as.d >= 3) out.push({ p: 1, sev: as.d >= 5 ? 'crit' : 'warn', c: c, t: as.k === 'none' ? 'Nunca cargó datos' : 'Dejó de cargar datos', d: as.t + '. Un cliente que no mira sus números es un cliente que se puede ir.', acts: [wa ? ['wa', 'Recordarle', '', 'Hola ' + c.nombre + '! ¿Cómo venís? Acordate de cargar los días en tu dashboard así vemos juntos cómo viene la caja 📊'] : null] });
      if (c._n7 < 0) out.push({ p: 1, sev: 'crit', c: c, t: 'Viene perdiendo plata', d: 'Ganancia neta de los últimos 7 días: ' + full(c._n7) + '. Revisá su pauta y llamalo antes de que lo note él.', acts: [['view', 'Ver dashboard', '']] });
    });
    return out.sort(function (a, b) { return a.p - b.p; });
  }

  function drawAdmin() {
    var q = S.q.toLowerCase(), act = S.clients.filter(function (c) { return c.activo; });
    var mrr = { USD: 0, ARS: 0 }, cob = { USD: 0, ARS: 0 };
    act.forEach(function (c) { mrr[c._cta.moneda || 'USD'] += n(c._cta.abono); });
    (S.pagosMes || []).forEach(function (p) { cob[p.moneda || 'USD'] += n(p.monto); });
    function both(o) { var s = []; if (o.USD || !o.ARS) s.push(cur(o.USD, 'USD')); if (o.ARS) s.push(cur(o.ARS, 'ARS')); return s.join(' + '); }
    var pend = { USD: Math.max(0, mrr.USD - cob.USD), ARS: Math.max(0, mrr.ARS - cob.ARS) };
    var TD = todos(), nuevos = S.clients.filter(function (c) { return c.creado && c.creado.slice(0, 7) === today().slice(0, 7); }).length;
    var list = S.clients.filter(function (c) { return !q || (c.nombre + ' ' + c.email).toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { if (a.activo !== b.activo) return a.activo ? -1 : 1; var sa = (cobroState(a).k === 'bad') * 2 + (actState(a).k === 'bad'), sb2 = (cobroState(b).k === 'bad') * 2 + (actState(b).k === 'bad'); return sb2 - sa || b._neta - a._neta; });
    var h = '<div class="wrap">' + shell('clientes', '<span class="hide-sm">' + esc(S.me.email) + '</span>' + (DEMO ? '' : '<button class="btn sm" id="out">Salir</button>')) +
      '<div class="head"><div><span class="lbl">Tu negocio · ' + MESL[parse(today()).getMonth()] + '</span><h1>Clientes</h1><p class="range">' + act.length + ' activos de ' + S.clients.length + (nuevos ? ' · ' + nuevos + (nuevos === 1 ? ' nuevo' : ' nuevos') + ' este mes' : '') + '</p></div></div>';
    if (S.noBilling) h += '<p class="note-warn">Para ver abonos y cobros, corré en Supabase el archivo <b>supabase-actualizacion-1.sql</b> (SQL Editor → Run).</p>';
    h += '<section class="kpis">' +
      '<article class="card kpi" style="--c:var(--green)"><div class="ch"><span class="ico">' + I.wallet + '</span><span class="lbl">Ingreso mensual</span></div><div class="val">' + both(mrr) + '</div><div class="vs" style="margin-top:10px">abonos de los ' + act.length + ' clientes activos</div></article>' +
      '<article class="card kpi" style="--c:var(--blue)"><div class="ch"><span class="ico">' + I.receipt + '</span><span class="lbl">Cobrado este mes</span></div><div class="val">' + both(cob) + '</div><div class="vs" style="margin-top:10px">' + (pend.USD || pend.ARS ? 'falta cobrar ' + both(pend) : 'todo cobrado') + '</div></article>' +
      '<article class="card kpi" style="--c:var(--violet)"><div class="ch"><span class="ico">' + I.users + '</span><span class="lbl">Clientes activos</span></div><div class="val">' + act.length + '</div><div class="vs" style="margin-top:10px">' + (S.clients.length - act.length) + (S.clients.length - act.length === 1 ? ' suspendido' : ' suspendidos') + '</div></article>' +
      '<article class="card kpi" style="--c:' + (TD.length ? 'var(--red)' : 'var(--green)') + '"><div class="ch"><span class="ico">' + I.target + '</span><span class="lbl">Para hacer hoy</span></div><div class="val">' + TD.length + '</div><div class="vs" style="margin-top:10px">' + (TD.length ? 'cobros, clientes inactivos o en pérdida' : 'nada pendiente') + '</div></article></section>';
    h += '<section class="grid2"><article class="card wide" style="--c:var(--red)"><div class="ch"><span class="ico">' + I.list + '</span><div><h2>Para hacer hoy</h2><p class="sub">Lo que te puede costar plata o un cliente si lo dejás pasar</p></div></div>' +
      (TD.length ? '<div class="todo">' + TD.map(function (t, i) {
        return '<div class="td ' + t.sev + '"><div><h3><b>' + esc(t.c.nombre) + '</b> · ' + t.t + '</h3><p>' + esc(t.d) + '</p></div><div class="acts">' + t.acts.filter(Boolean).map(function (a) {
          if (a[0] === 'wa') { var u = waTo(t.c._cta.whatsapp, a[3]); return u ? '<a class="btn sm" href="' + u + '" target="_blank" rel="noopener">' + I.wa + ' ' + a[1] + '</a>' : ''; }
          return '<button class="btn sm ' + a[2] + '" data-' + a[0] + '="' + t.c.id + '">' + a[1] + '</button>';
        }).join('') + '</div></div>';
      }).join('') + '</div>' : '<p class="muted" style="margin-top:14px">Todo en orden: nadie debe, todos cargan y nadie viene en pérdida.</p>') + '</article></section>';
    h += '<section class="grid2"><article class="card wide" style="--c:var(--blue)"><div class="ch"><span class="ico">' + I.users + '</span><div><h2>Todos los clientes</h2><p class="sub">Los que necesitan atención aparecen primero</p></div><input id="q" class="search" type="search" placeholder="Buscar cliente" aria-label="Buscar cliente" value="' + esc(S.q) + '"></div>' +
      '<div class="tbl-wrap"><table class="table adm"><thead><tr><th>Cliente</th><th>Abono</th><th>Actividad</th><th>Ganancia 30 días</th><th></th></tr></thead><tbody>' +
      (list.map(function (c) {
        var cs = cobroState(c), as = actState(c);
        return '<tr' + (c.activo ? '' : ' class="off-row"') + '><td><b>' + esc(c.nombre || '—') + '</b> ' + (c.activo ? '' : '<span class="st off">Suspendido</span>') + '<br><span class="muted">' + esc(c.email) + '</span>' + (c._cta.notas ? '<br><span class="note">' + esc(c._cta.notas) + '</span>' : '') + '</td>' +
          '<td>' + (n(c._cta.abono) ? '<b class="num">' + cur(c._cta.abono, c._cta.moneda) + '</b><br>' : '') + '<span class="pill ' + cs.k + '">' + cs.t + '</span></td>' +
          '<td><span class="pill ' + as.k + '">' + as.t + '</span></td>' +
          '<td><div class="g30"><b class="num" style="color:' + (c._neta < 0 ? 'var(--red)' : 'var(--text)') + '">' + money(c._neta) + '</b>' + miniSpark(c._series) + '</div></td>' +
          '<td><div class="actions"><button class="btn sm" data-view="' + c.id + '">Ver dashboard</button><button class="btn sm" data-edit-c="' + c.id + '">Editar</button><button class="btn sm ' + (c.activo ? 'danger' : 'ok') + '" data-tog="' + c.id + '">' + (c.activo ? 'Suspender' : 'Reactivar') + '</button></div></td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted">' + (S.clients.length ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes. Crealos en Supabase → Authentication → Users → Add user.') + '</td></tr>') +
      '</tbody></table></div></article></section>' +
      '<p class="muted" style="font-size:13px">Cliente nuevo: Supabase → Authentication → Users → Add user. Aparece acá solo; después tocá <b>Editar</b> para cargarle el abono y su WhatsApp.</p></div>';
    app.innerHTML = h;
    if ($('#out')) $('#out').onclick = logout;
    $('#q').oninput = function () { S.q = this.value; var pos = this.selectionStart; drawAdmin(); var i = $('#q'); i.focus(); i.setSelectionRange(pos, pos); };
    function byId(id) { return S.clients.find(function (c) { return c.id === id; }); }
    $$('[data-view]').forEach(function (b) { b.onclick = async function () { S.viewing = byId(b.dataset.view); if (DEMO) S.regs = demoRegs(); else await loadRegs(); S.period = '30'; renderDash(); }; });
    $$('[data-edit-c]').forEach(function (b) { b.onclick = function () { editClient(byId(b.dataset.editC)); }; });
    $$('[data-paid]').forEach(function (b) { b.onclick = function () { markPaid(byId(b.dataset.paid)); }; });
    $$('[data-tog]').forEach(function (b) {
      b.onclick = async function () {
        var c = byId(b.dataset.tog);
        if (c.activo && b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Seguro?'; return; }
        if (!DEMO) { var r = await sb.from('perfiles').update({ activo: !c.activo }).eq('id', c.id); if (r.error) { toast('No se pudo cambiar el estado'); return; } }
        c.activo = !c.activo; toast(c.activo ? 'Acceso reactivado' : 'Acceso suspendido'); drawAdmin();
      };
    });
  }

  async function markPaid(c) {
    var monto = n(c._cta.abono), next = addMonth(c._cta.proximo_cobro || today());
    if (!DEMO) {
      var r1 = await sb.from('pagos').insert({ user_id: c.id, monto: monto, moneda: c._cta.moneda || 'USD', fecha: today() });
      if (r1.error) { toast('No se pudo registrar el pago'); return; }
      var r2 = await sb.from('cuentas').upsert({ user_id: c.id, abono: monto, moneda: c._cta.moneda || 'USD', proximo_cobro: next, whatsapp: c._cta.whatsapp || '', notas: c._cta.notas || '', actualizado: new Date().toISOString() });
      if (r2.error) { toast('Pago registrado, pero no se pudo mover la fecha del próximo cobro'); }
    }
    (S.pagosMes = S.pagosMes || []).push({ user_id: c.id, monto: monto, moneda: c._cta.moneda || 'USD' });
    c._cta.proximo_cobro = next; toast('Cobro registrado · próximo: ' + short(next)); drawAdmin();
  }

  function editClient(c) {
    var k = c._cta, dlg = document.createElement('dialog');
    dlg.innerHTML = '<form class="modal" method="dialog" id="ef"><h2>' + esc(c.nombre) + '</h2><p class="muted" style="font-size:13px;margin-top:-8px">' + esc(c.email) + ' · solo vos ves estos datos</p><div class="fgrid">' +
      '<label class="field full">Nombre que ve en su dashboard<input id="e_n" value="' + esc(c.nombre) + '" maxlength="60"></label>' +
      '<label class="field">Abono mensual<input id="e_a" type="number" min="0" step="1" inputmode="numeric" value="' + (n(k.abono) || '') + '"></label>' +
      '<label class="field">Moneda<select id="e_m"><option value="USD"' + (k.moneda !== 'ARS' ? ' selected' : '') + '>Dólares (US$)</option><option value="ARS"' + (k.moneda === 'ARS' ? ' selected' : '') + '>Pesos ($)</option></select></label>' +
      '<label class="field">Próximo cobro<input id="e_p" type="date" value="' + (k.proximo_cobro || '') + '"></label>' +
      '<label class="field">WhatsApp (con 549…)<input id="e_w" inputmode="tel" placeholder="5491155555555" value="' + esc(k.whatsapp) + '"></label>' +
      '<label class="field full">Objetivo de ganancia diaria ($)<input id="e_g" type="number" min="0" step="1000" inputmode="numeric" value="' + (n(c.objetivo_diario) || '') + '"></label>' +
      '<label class="field full">Notas<textarea id="e_t" rows="3" maxlength="500" placeholder="Ej: quiere escalar en diciembre, prefiere que le hablen a la tarde">' + esc(k.notas) + '</textarea></label>' +
      '</div><p class="err" id="eerr"></p><div class="mrow"><button class="btn" type="button" id="ecancel">Cancelar</button><button class="btn pri" type="submit">Guardar</button></div></form>';
    document.body.appendChild(dlg); dlg.showModal();
    dlg.addEventListener('close', function () { dlg.remove(); });
    $('#ecancel', dlg).onclick = function () { dlg.close(); };
    $('#ef', dlg).onsubmit = async function (e) {
      e.preventDefault();
      var cta = { user_id: c.id, abono: Math.max(0, n($('#e_a', dlg).value)), moneda: $('#e_m', dlg).value, proximo_cobro: $('#e_p', dlg).value || null, whatsapp: $('#e_w', dlg).value.replace(/\D/g, ''), notas: $('#e_t', dlg).value.trim(), actualizado: new Date().toISOString() };
      var perf = { nombre: $('#e_n', dlg).value.trim() || c.nombre, objetivo_diario: Math.max(0, n($('#e_g', dlg).value)) };
      if (!DEMO) {
        var r1 = await sb.from('perfiles').update(perf).eq('id', c.id), r2 = await sb.from('cuentas').upsert(cta);
        if (r1.error || r2.error) { $('#eerr', dlg).textContent = r2.error ? 'No se pudo guardar el abono. ¿Corriste supabase-actualizacion-1.sql en Supabase?' : 'No se pudo guardar.'; return; }
      }
      Object.assign(c, perf); c._cta = cta; dlg.close(); toast('Cliente actualizado'); drawAdmin();
    };
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
    app.innerHTML = '<div class="wrap">' + shell('agencia') + '<p class="muted">Cargando cuentas…</p></div>';
    if (DEMO) { demoAgencia(); return drawAgencia(); }
    var r = await Promise.all([sb.from('agencia_clientes').select('*').order('fecha_ingreso', { ascending: false }), sb.from('agencia_pagos').select('*').order('fecha', { ascending: false }).limit(5000)]);
    if (r[0].error || r[1].error) {
      app.innerHTML = '<div class="wrap">' + shell('agencia') + '<p class="note-warn">Para usar las cuentas de la agencia, corré en Supabase el archivo <b>supabase-actualizacion-2.sql</b> (SQL Editor → New query → Run) y recargá esta página.</p></div>';
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

  function adminRoute() { if (location.hash === '#agencia') renderAgencia(); else renderAdmin(); }
  window.addEventListener('hashchange', function () { if (S.me && S.me.rol === 'admin' && (location.hash === '#agencia' || location.hash === '#admin' || location.hash === '')) adminRoute(); });

  start().catch(function (e) { console.error(e); app.innerHTML = '<div class="auth"><div class="auth-card"><h1>No se pudo cargar</h1><p class="muted">Revisá tu conexión y recargá la página.</p></div></div>'; });
})();
