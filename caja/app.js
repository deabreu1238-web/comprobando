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
    if (S.me.rol === 'admin') return renderAdmin();
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
  async function renderAdmin() {
    app.innerHTML = '<div class="wrap"><p class="muted">Cargando clientes…</p></div>';
    var p = await sb.from('perfiles').select('*').order('creado', { ascending: false });
    var since = addDays(today(), -29);
    var r = await sb.from('registros').select('user_id,fecha,ingresos,premios,fichas,meta_ads,comisiones,otros_gastos').gte('fecha', since).limit(20000);
    var last = await sb.from('registros').select('user_id,fecha').order('fecha', { ascending: false }).limit(5000);
    if (p.error) { app.innerHTML = '<div class="wrap"><p class="err">No se pudieron cargar los clientes.</p></div>'; return; }
    var agg = {}, lastBy = {};
    (r.data || []).forEach(function (x) { agg[x.user_id] = (agg[x.user_id] || 0) + neta(x); });
    (last.data || []).forEach(function (x) { if (!lastBy[x.user_id]) lastBy[x.user_id] = x.fecha; });
    S.clients = p.data.filter(function (c) { return c.rol === 'cliente'; }).map(function (c) { c._neta = agg[c.id] || 0; c._last = lastBy[c.id] || null; return c; });
    drawAdmin();
  }
  function drawAdmin() {
    var q = S.q.toLowerCase(), list = S.clients.filter(function (c) { return !q || (c.nombre + ' ' + c.email).toLowerCase().indexOf(q) >= 0; });
    var act = S.clients.filter(function (c) { return c.activo; }).length;
    var h = '<div class="wrap"><div class="top"><div class="brand">' + MARK + esc(CFG.marca || 'PanelPro') + '</div><div class="who"><span class="chip admin">Admin</span><span>' + esc(S.me.email) + '</span><button class="btn sm" id="out">Salir</button></div></div>' +
      '<div class="head"><div><span class="lbl">Administración</span><h1>Clientes</h1><p class="range">' + act + ' activos de ' + S.clients.length + '</p></div>' +
      '<div class="actions"><input id="q" class="btn" style="min-width:220px;cursor:text" placeholder="Buscar por nombre o email" value="' + esc(S.q) + '"></div></div>' +
      '<article class="card" style="--c:var(--blue)"><div class="tbl-wrap"><table class="table"><thead><tr><th>Cliente</th><th>Estado</th><th>Último día cargado</th><th>Ganancia 30 días</th><th></th></tr></thead><tbody>' +
      (list.map(function (c) {
        return '<tr><td><b>' + esc(c.nombre || '—') + '</b><br><span class="muted">' + esc(c.email) + '</span></td><td><span class="st ' + (c.activo ? 'on' : 'off') + '">' + (c.activo ? 'Activo' : 'Suspendido') + '</span></td>' +
          '<td>' + (c._last ? short(c._last) : '<span class="muted">Sin datos</span>') + '</td><td class="num" style="color:' + (c._neta < 0 ? 'var(--red)' : 'var(--text)') + '">' + full(c._neta) + '</td>' +
          '<td><div class="actions"><button class="btn sm" data-view="' + c.id + '">Ver dashboard</button><button class="btn sm ' + (c.activo ? 'danger' : 'ok') + '" data-tog="' + c.id + '">' + (c.activo ? 'Suspender' : 'Reactivar') + '</button></div></td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted">Todavía no hay clientes. Invitalos desde Supabase → Authentication → Users.</td></tr>') +
      '</tbody></table></div></article>' +
      '<p class="muted" style="margin-top:16px;font-size:13.5px">Para dar acceso a un cliente nuevo: Supabase → Authentication → Users → Add user. Aparece acá automáticamente.</p></div>';
    app.innerHTML = h;
    $('#out').onclick = logout;
    $('#q').oninput = function () { S.q = this.value; var pos = this.selectionStart; drawAdmin(); var i = $('#q'); i.focus(); i.setSelectionRange(pos, pos); };
    $$('[data-view]').forEach(function (b) { b.onclick = async function () { S.viewing = S.clients.find(function (c) { return c.id === b.dataset.view; }); await loadRegs(); S.period = '30'; renderDash(); }; });
    $$('[data-tog]').forEach(function (b) {
      b.onclick = async function () {
        var c = S.clients.find(function (x) { return x.id === b.dataset.tog; });
        if (c.activo && b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Seguro?'; return; }
        var r = await sb.from('perfiles').update({ activo: !c.activo }).eq('id', c.id);
        if (r.error) { toast('No se pudo cambiar el estado'); return; }
        c.activo = !c.activo; toast(c.activo ? 'Acceso reactivado' : 'Acceso suspendido'); drawAdmin();
      };
    });
  }

  start().catch(function (e) { console.error(e); app.innerHTML = '<div class="auth"><div class="auth-card"><h1>No se pudo cargar</h1><p class="muted">Revisá tu conexión y recargá la página.</p></div></div>'; });
})();
