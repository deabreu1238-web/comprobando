// Centro de control PanelPro: vista previa con datos de ejemplo.
(function () {
  'use strict';
  var app = document.getElementById('app');
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function usd(v, d) { return 'US$ ' + Number(v).toLocaleString('es-AR', { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 0 : d }); }
  function n(v) { return Number(v).toLocaleString('es-AR'); }
  function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2600); }

  // ------------------------------------------------------------ datos de ejemplo
  var ACC = [
    { id: 1, cliente: 'Norte', cuenta: 'act_…4821', estado: 'activa', presu: 80, gasto: 61.4, res: 22, obj: 4, cpr7: [3.1, 3.4, 2.9, 3.3, 3.0, 2.8, 2.8] },
    { id: 2, cliente: 'Litoral', cuenta: 'act_…1907', estado: 'activa', presu: 50, gasto: 38.4, res: 6, obj: 4, cpr7: [3.8, 4.1, 4.6, 5.2, 5.9, 6.1, 6.4] },
    { id: 3, cliente: 'Costa', cuenta: 'act_…7734', estado: 'pago', presu: 60, gasto: 0, res: 0, obj: 3.5, cpr7: [3.2, 3.0, 3.4, 3.1, 3.3, 0, 0] },
    { id: 4, cliente: 'Delta', cuenta: 'act_…5590', estado: 'activa', presu: 120, gasto: 97.8, res: 41, obj: 3.5, cpr7: [3.0, 2.9, 2.6, 2.7, 2.5, 2.4, 2.4] },
    { id: 5, cliente: 'Andes', cuenta: 'act_…3318', estado: 'restringida', presu: 40, gasto: 0, res: 0, obj: 4, cpr7: [4.2, 3.9, 4.4, 4.0, 0, 0, 0] },
    { id: 6, cliente: 'Centro', cuenta: 'act_…8862', estado: 'activa', presu: 50, gasto: 44.1, res: 13, obj: 4, cpr7: [3.6, 3.5, 3.9, 3.4, 3.7, 3.3, 3.4] },
    { id: 7, cliente: 'Sur', cuenta: 'act_…2045', estado: 'activa', presu: 35, gasto: 27.9, res: 0, obj: 4, cpr7: [3.9, 4.3, 4.0, 4.8, 5.1, 6.0, 0] },
    { id: 8, cliente: 'Oeste', cuenta: 'act_…6613', estado: 'activa', presu: 70, gasto: 49.5, res: 15, obj: 4, cpr7: [4.0, 3.8, 3.7, 3.5, 3.4, 3.3, 3.3] },
  ];
  var ALERTS = [
    { id: 'a1', sev: 'crit', icon: '!', who: 'Andes', title: 'Cuenta publicitaria restringida', text: 'Meta restringió la cuenta a las 09:12. Los anuncios están frenados. Revisá el motivo y, si corresponde, pedí una revisión una sola vez.', acts: [['Ver en Meta', ''], ['Avisar al cliente', 'pri']] },
    { id: 'a2', sev: 'crit', icon: '$', who: 'Costa', title: 'Pago rechazado: la cuenta dejó de gastar', text: 'La tarjeta fue rechazada a las 07:40. Hasta que el cliente cargue un medio de pago válido, no se entrega nada.', acts: [['Mandar aviso de pago', 'pri']] },
    { id: 'a3', sev: 'warn', icon: '↗', who: 'Litoral', title: 'El costo por resultado subió 60% en 5 días', text: 'Pasó de US$ 3,80 a US$ 6,40 (tu objetivo es US$ 4). El sistema ya bajó el presupuesto un 20%. Probablemente los anuncios estén gastados: conviene subir anuncios nuevos.', acts: [['Pausar campaña', 'danger'], ['Ignorar', '']] },
    { id: 'a4', sev: 'info', icon: '×', who: 'Sur', title: 'Anuncio rechazado: «Video testimonio v2»', text: 'Meta lo rechazó por su política de publicidad. El resto de los anuncios sigue activo.', acts: [['Ver motivo', '']] },
  ];
  var LOG = [
    ['14:05', 'pause', 'Sur', 'Pausó el anuncio <b>«Carrusel resultados»</b>: gastó US$ 12 sin resultados (más de 3× tu objetivo).'],
    ['13:00', 'up', 'Delta', 'Subió el presupuesto de <b>US$ 100 a US$ 120</b>: costo por resultado 31% abajo del objetivo, 3 días seguidos.'],
    ['12:00', 'down', 'Litoral', 'Bajó el presupuesto de <b>US$ 62 a US$ 50</b>: costo por resultado 60% arriba del objetivo, 2 días seguidos.'],
    ['09:12', 'pause', 'Andes', 'Detectó la <b>cuenta restringida</b> y te avisó por WhatsApp.'],
    ['07:40', 'pause', 'Costa', 'Detectó el <b>pago rechazado</b> y te avisó por WhatsApp.'],
    ['07:00', 'ok', 'Todas', 'Mandó el <b>resumen diario</b> y los reportes semanales a 8 clientes.'],
  ];
  var RULES = [
    { on: true, t: 'Cortar lo que gasta sin resultados', d: 'Pausa un anuncio si gastó <span class="k">3× el costo objetivo</span> sin traer ningún resultado.' },
    { on: true, t: 'Escalar lo que funciona', d: 'Sube el presupuesto <span class="k">20%</span> si el costo por resultado está <span class="k">20% abajo del objetivo 3 días seguidos</span>. Máximo una vez cada 72 h, para no reiniciar el aprendizaje.' },
    { on: true, t: 'Frenar lo que se dispara', d: 'Baja el presupuesto <span class="k">20%</span> si el costo por resultado está <span class="k">50% arriba del objetivo 2 días seguidos</span>.' },
    { on: true, t: 'Alertas de salud de la cuenta', d: 'Te avisa al instante si una cuenta queda <span class="k">restringida</span>, si <span class="k">rechazan un pago</span> o si <span class="k">rechazan un anuncio</span>.' },
    { on: true, t: 'Anuncios gastados', d: 'Avisa cuando un anuncio supera <span class="k">frecuencia 3,5</span> en 7 días: es momento de subir anuncios nuevos.' },
    { on: false, t: 'Reporte semanal al cliente', d: 'Cada lunes 9 h le manda a cada cliente su resumen de la semana: gasto, resultados y costo por resultado.' },
  ];

  // ------------------------------------------------------------ cálculos
  function cpr(a) { return a.res ? a.gasto / a.res : null; }
  function health(a) {
    if (a.estado !== 'activa') return 0;
    var c = cpr(a), s = 100;
    if (c == null) s -= a.gasto > a.obj * 3 ? 55 : 20; else if (c > a.obj) s -= Math.min(50, (c / a.obj - 1) * 100);
    var t = a.cpr7.filter(Boolean); if (t.length > 2 && t[t.length - 1] > t[0] * 1.3) s -= 15;
    return Math.max(5, Math.round(s));
  }
  function hcolor(h) { return h >= 75 ? ['rgba(46,229,157,.14)', 'var(--green)'] : h >= 50 ? ['rgba(251,191,36,.14)', 'var(--amber)'] : ['rgba(255,107,107,.15)', 'var(--red)']; }
  function mini(vals, obj) {
    var v = vals.map(function (x) { return x || null; }), real = v.filter(Boolean);
    if (real.length < 2) return '<svg class="mini"></svg>';
    var max = Math.max.apply(null, real.concat([obj])) * 1.1, min = Math.min.apply(null, real.concat([obj])) * 0.9, W = 96, H = 30;
    function Y(x) { return (H - 3 - (x - min) / (max - min) * (H - 6)).toFixed(1); }
    var d = '', on = false;
    v.forEach(function (x, i) { if (!x) { on = false; return; } d += (on ? 'L' : 'M') + (i / (v.length - 1) * W).toFixed(1) + ' ' + Y(x); on = true; });
    var bad = real[real.length - 1] > obj;
    return '<svg class="mini" viewBox="0 0 96 30" aria-hidden="true"><line x1="0" x2="96" y1="' + Y(obj) + '" y2="' + Y(obj) + '" stroke="#f5c451" stroke-dasharray="3 3" opacity=".6"/><path d="' + d + '" fill="none" stroke="' + (bad ? '#ff6b6b' : '#2ee59d') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  // ------------------------------------------------------------ vista
  var MARK = '<span class="mark"><svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2 12 6 7l3 3 5-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  var IC = {
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M13 3 5 14h6l-1 7 8-11h-6z"/></svg>',
    log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="8.5"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>',
    rule: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/></svg>',
    usd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v18M16.5 7.5c-.6-1.2-2.2-2-4.3-2-2.6 0-4.2 1.3-4.2 3s1.6 2.5 4.2 3 4.3 1.4 4.3 3.2-1.8 3-4.4 3c-2.1 0-3.8-.8-4.5-2.2"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.4 3.4-5.3 6.5-5.3s5.7 1.9 6.5 5.3M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.9c2 .7 3.2 2.4 3.6 5.1"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  };
  function kpi(c, icon, lbl, val, sub) {
    return '<article class="card kpi" style="--c:' + c + '"><div class="ch"><span class="ico">' + icon + '</span><span class="lbl">' + lbl + '</span></div><div class="val">' + val + '</div><div class="vs" style="margin-top:10px">' + sub + '</div></article>';
  }

  function render() {
    var gasto = ACC.reduce(function (s, a) { return s + a.gasto; }, 0), presu = ACC.reduce(function (s, a) { return s + a.presu; }, 0);
    var res = ACC.reduce(function (s, a) { return s + a.res; }, 0), ok = ACC.filter(function (a) { return health(a) >= 75; }).length;
    var crit = ALERTS.filter(function (a) { return a.sev === 'crit'; }).length;
    var h = '<div class="wrap">';
    h += '<div class="top"><div class="brand">' + MARK + 'PanelPro</div><div class="who"><span class="chip demo">Vista previa</span><span class="chip admin">Admin</span></div></div>';
    h += '<div class="head"><div><span class="lbl">Todas tus cuentas en un lugar</span><h1>Centro de control</h1><p class="cc-status"><i></i>Revisó las ' + ACC.length + ' cuentas hace 4 minutos · próxima revisión 15:00</p></div>' +
      '<div class="actions"><button class="btn" id="sum">' + IC.wa + ' Ver resumen diario</button></div></div>';
    h += '<section class="kpis">' +
      kpi('var(--blue)', IC.usd, 'Gasto de hoy', usd(gasto), 'de ' + usd(presu) + ' presupuestados') +
      kpi('var(--green)', IC.users, 'Resultados de hoy', n(res), 'interesados en todas las cuentas') +
      kpi('var(--violet)', IC.target, 'Costo por resultado', usd(gasto / res, 2), 'promedio de todas las cuentas') +
      kpi(crit ? 'var(--red)' : 'var(--green)', IC.shield, 'Cuentas sanas', ok + ' / ' + ACC.length, crit ? '<span style="color:var(--red);font-weight:700">' + crit + ' necesitan tu atención ya</span>' : 'todo en orden') +
      '</section>';
    h += '<section class="grid2"><article class="card wide" style="--c:var(--red)"><div class="ch"><span class="ico">' + IC.bolt + '</span><div><h2>Necesita tu decisión</h2><p class="sub">Solo lo que el sistema no puede resolver solo</p></div></div><div class="alerts">' +
      (ALERTS.length ? ALERTS.map(function (a) {
        return '<div class="alert ' + a.sev + '" data-a="' + a.id + '"><span class="sev">' + a.icon + '</span><div><h3><span class="who">' + esc(a.who) + '</span> · ' + esc(a.title) + '</h3><p>' + esc(a.text) + '</p></div><div class="acts">' +
          a.acts.map(function (b) { return '<button class="btn sm ' + b[1] + '" data-act="' + a.id + '">' + b[0] + '</button>'; }).join('') + '</div></div>';
      }).join('') : '<p class="muted">Nada pendiente. El sistema está manejando todo.</p>') + '</div></article></section>';
    h += '<section class="grid2"><article class="card wide" style="--c:var(--blue)"><div class="ch"><span class="ico">' + IC.grid + '</span><div><h2>Cuentas</h2><p class="sub">Estado de hoy de cada cliente</p></div></div><div class="tbl-wrap"><table class="table acc-t"><thead><tr><th>Cliente</th><th>Estado</th><th>Gasto de hoy</th><th>Resultados</th><th>Costo por resultado</th><th>Últimos 7 días</th><th>Salud</th></tr></thead><tbody>' +
      ACC.slice().sort(function (a, b) { return health(a) - health(b); }).map(function (a) {
        var c = cpr(a), hs = health(a), hc = hcolor(hs);
        var st = a.estado === 'activa' ? '<span class="st on">Activa</span>' : a.estado === 'pago' ? '<span class="st warn">Pago rechazado</span>' : '<span class="st off">Restringida</span>';
        return '<tr class="acc"><td class="name"><b>' + esc(a.cliente) + '</b><span>' + a.cuenta + '</span></td><td>' + st + '</td>' +
          '<td class="budget"><b class="num">' + usd(a.gasto) + '</b> <small>de ' + usd(a.presu) + '</small><div class="bar"><i style="width:' + Math.min(100, a.gasto / a.presu * 100).toFixed(0) + '%"></i></div></td>' +
          '<td class="num"><b>' + a.res + '</b></td>' +
          '<td class="cpr num ' + (c == null ? (a.gasto ? 'bad' : '') : c > a.obj ? 'bad' : 'good') + '"><b>' + (c == null ? '—' : usd(c, 2)) + '</b><small>objetivo ' + usd(a.obj, 2) + '</small></td>' +
          '<td>' + mini(a.cpr7, a.obj) + '</td><td><span class="hscore" style="background:' + hc[0] + ';color:' + hc[1] + '">' + hs + '</span></td></tr>';
      }).join('') + '</tbody></table></div></article></section>';
    h += '<section class="grid2"><article class="card" style="--c:var(--violet)"><div class="ch"><span class="ico">' + IC.log + '</span><div><h2>Lo que hizo el sistema hoy</h2><p class="sub">Cambios automáticos según tus reglas</p></div></div><ul class="log">' +
      LOG.map(function (l) { var tag = { pause: 'Pausó', up: 'Escaló', down: 'Frenó', ok: 'Envió' }[l[1]]; if (/Detectó/.test(l[3])) tag = 'Alerta'; return '<li><time>' + l[0] + '</time><span><span class="tag ' + l[1] + '">' + tag + '</span><b>' + esc(l[2]) + '</b> · ' + l[3] + '</span></li>'; }).join('') + '</ul></article>';
    h += '<article class="card" style="--c:var(--green)"><div class="ch"><span class="ico">' + IC.rule + '</span><div><h2>Tus reglas</h2><p class="sub">Se aplican a todas las cuentas; cada cliente con su costo objetivo</p></div></div><div class="rules">' +
      RULES.map(function (r, i) { return '<div class="rule"><div><h3>' + r.t + '</h3><p>' + r.d + '</p></div><button class="switch" role="switch" aria-checked="' + r.on + '" aria-label="' + esc(r.t) + '" data-rule="' + i + '"></button></div>'; }).join('') + '</div></article></section>';
    h += '<p class="watermark">Vista previa con datos de ejemplo · PanelPro</p></div>';
    app.innerHTML = h;

    $$('[data-rule]').forEach(function (b) { b.onclick = function () { var r = RULES[b.dataset.rule]; r.on = !r.on; b.setAttribute('aria-checked', r.on); toast(r.on ? 'Regla activada' : 'Regla desactivada'); }; });
    $$('[data-act]').forEach(function (b) { b.onclick = function () { ALERTS = ALERTS.filter(function (a) { return a.id !== b.dataset.act; }); toast('Listo: ' + b.textContent.toLowerCase()); render(); }; });
    $('#sum').onclick = openSummary;
  }

  function summaryText() {
    var gasto = ACC.reduce(function (s, a) { return s + a.gasto; }, 0), res = ACC.reduce(function (s, a) { return s + a.res; }, 0);
    return '<b>☀️ Resumen PanelPro · ayer</b>\n\n' +
      '💰 Gasto: ' + usd(gasto) + '\n🙋 Resultados: ' + res + '\n🎯 Costo por resultado: ' + usd(gasto / res, 2) + '\n\n' +
      '<b>🚨 Para resolver hoy (2)</b>\n• Andes: cuenta restringida\n• Costa: pago rechazado, avisale al cliente\n\n' +
      '<b>🤖 Lo que hice solo (3)</b>\n• Delta: subí el presupuesto a US$ 120 (viene 31% abajo del objetivo)\n• Litoral: bajé el presupuesto a US$ 50 (costo 60% arriba)\n• Sur: pausé 1 anuncio sin resultados\n\n' +
      '<b>🏆 Mejor cuenta:</b> Delta, 41 resultados a US$ 2,39\n<b>🎨 Anuncios nuevos:</b> Litoral y Sur los necesitan esta semana';
  }
  function openSummary() {
    var dlg = document.createElement('dialog');
    dlg.innerHTML = '<div class="modal"><h2>Resumen diario por WhatsApp</h2><p class="muted" style="font-size:13.5px">Así te llegaría todos los días a las 7:00.</p><div class="phone"><div class="from">PanelPro Bot</div><div class="bubble">' + summaryText() + '<time>07:00</time></div></div><div class="mrow"><button class="btn pri" id="cls">Cerrar</button></div></div>';
    document.body.appendChild(dlg); dlg.showModal();
    dlg.addEventListener('close', function () { dlg.remove(); });
    $('#cls', dlg).onclick = function () { dlg.close(); };
  }

  render();
})();
