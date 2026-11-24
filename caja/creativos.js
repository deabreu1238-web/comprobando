// Banco creativo PanelPro: marca por cliente, generador de anuncios en serie y biblioteca con rendimiento.
(function () {
  'use strict';
  var CFG = window.CAJA_CONFIG || {};
  var SB = (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase) ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true } }) : null;
  var app = document.getElementById('app');
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2600); }
  function lines(s) { return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function usd(v) { return 'US$ ' + Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function slug(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  var KEY = 'pp_banco_v2';
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY));
      if (d) return d;
      var old = JSON.parse(localStorage.getItem('pp_banco_v1'));
      if (old && old.clients) { Object.keys(old.clients).forEach(function (k) { old.clients[k].lib = (old.clients[k].lib || []).filter(function (x) { return !/^(norte|delta|litoral|sur)\d+$/.test(x.id); }); }); return old; }
    } catch (e) {}
    return null;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast('No se pudo guardar en este navegador'); } }

  // ------------------------------------------------------------ marcas de ejemplo
  function brand(nombre, c1, c2, extra) {
    return Object.assign({ nombre: nombre, c1: c1, c2: c2, logo: '',
      estilo: 'ambos',
      titulares: 'Te respondemos en *menos de 5 minutos*\nAtención real, *las 24 horas*\nTodo resuelto *desde tu WhatsApp*',
      bajada: 'Escribinos y una persona de nuestro equipo te atiende al instante.', cta: 'Escribinos por WhatsApp', sello: 'Atención 24/7',
      beneficios: 'Respuesta en minutos\nAtención personalizada\nTodo por WhatsApp\nSin vueltas ni demoras',
      otros: 'Te responden cuando pueden\nAtención automática\nTenés que llamar o ir\nTrámites largos',
      pasos: 'Nos escribís por WhatsApp\nTe atiende una persona real\nListo, en minutos',
      chatQ: 'Hola! ¿Están atendiendo ahora?', chatA: '¡Hola! Sí, estamos las 24 hs. ¿En qué te ayudamos?', chatQ2: 'Genial, quiero empezar hoy', chatA2: 'Perfecto, te paso los pasos y en 2 minutos quedás listo', nota: '¡En 2 minutos!',
      notifs: '¡Hola! Ya te estamos atendiendo\nListo, quedó todo resuelto\n¿Te ayudamos con algo más?\nGracias por elegirnos',
      dato: '2 min', datoTxt: 'es lo que tardamos en *responderte*',
      testimonio: 'Me respondieron al toque y me resolvieron todo en el día. Atención de diez, los recomiendo.', autor: 'Martín G., cliente', refs: [], lib: [] }, extra || {});
  }
  var DB = load() || { sel: 'norte', clients: {
    norte: brand('Norte', '#2b4dff', '#38d9f0'),
    delta: brand('Delta', '#7c3aed', '#f472b6'),
    litoral: brand('Litoral', '#059669', '#a3e635'),
    sur: brand('Sur', '#ea580c', '#fbbf24'),
  } };
  Object.keys(DB.clients).forEach(function (k) { var c = DB.clients[k], d = brand(c.nombre, c.c1, c.c2); Object.keys(d).forEach(function (f) { if (c[f] == null) c[f] = d[f]; }); });
  var UI = { step: 'gen', tpl: { gancho: true, chat: true, resena: true, vs: true, pasos: true, dato: true, foto: true, notif: true }, fmt: { '1x1': true, '4x5': false, '9x16': true }, out: [], copies: [], filter: 'todos', ai: { prompt: '', sel: [0, 1, 2], size: '1024x1024', n: 2, q: 'medium', busy: false, imgs: [], err: '' } };
  var FMT = PIEZAS.FMT, TPL = {};
  Object.keys(PIEZAS.TPL).forEach(function (k) { TPL[k] = PIEZAS.TPL[k].n; });
  var ESTILOS = { oscuro: 'Oscuro', claro: 'Claro', ambos: 'Los dos' };
  function estilos(b) { var e = b.estilo || 'ambos'; return e === 'ambos' ? ['oscuro', 'claro'] : [e]; }
  var EST = ['nuevo', 'activo', 'ganador', 'cansado', 'pausado'];
  var ESTL = { nuevo: 'Nuevo', activo: 'Activo', ganador: 'Ganador', cansado: 'Cansado', pausado: 'Pausado' };
  function C() { var c = DB.clients[DB.sel]; if (!c.refs) c.refs = []; return c; }
  function refsOf(b) { return b.refs || []; }

  // ------------------------------------------------------------ imágenes (logo, referencias)
  var logoCache = {};
  function logoImg(src) {
    if (!src) return Promise.resolve(null);
    if (logoCache[src]) return Promise.resolve(logoCache[src]);
    return new Promise(function (ok) { var i = new Image(); i.onload = function () { logoCache[src] = i; ok(i); }; i.onerror = function () { ok(null); }; i.src = src; });
  }

  // ------------------------------------------------------------ referencias
  function shrink(file, max, q) {
    return new Promise(function (ok) {
      var r = new FileReader();
      r.onload = function () { var im = new Image(); im.onload = function () { var s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', q)); }; im.onerror = function () { ok(null); }; im.src = r.result; };
      r.onerror = function () { ok(null); }; r.readAsDataURL(file);
    });
  }
  function hex(r, g, b) { return '#' + [r, g, b].map(function (v) { return Math.round(v).toString(16).padStart(2, '0'); }).join(''); }
  async function palette(srcs) {
    var buckets = {};
    for (var i = 0; i < srcs.length; i++) {
      var im = await logoImg(srcs[i]); if (!im) continue;
      var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d'); x.drawImage(im, 0, 0, 64, 64);
      var d = x.getImageData(0, 0, 64, 64).data;
      for (var p = 0; p < d.length; p += 4) {
        var r = d[p], g = d[p + 1], bl = d[p + 2], mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), sat = mx ? (mx - mn) / mx : 0;
        if (sat < .35 || mx < 70) continue;
        var hue = Math.round((Math.atan2(Math.sqrt(3) * (g - bl), 2 * r - g - bl) * 180 / Math.PI + 360) % 360 / 24);
        var k = buckets[hue] || (buckets[hue] = { n: 0, r: 0, g: 0, b: 0, w: 0 });
        var w = sat * mx / 255; k.n++; k.w += w; k.r += r * w; k.g += g * w; k.b += bl * w;
      }
    }
    var list = Object.keys(buckets).map(function (h) { var k = buckets[h]; return { h: +h, w: k.w, c: hex(k.r / k.w, k.g / k.w, k.b / k.w) }; }).sort(function (a, z) { return z.w - a.w; });
    if (!list.length) return null;
    var second = list.find(function (q) { var dh = Math.abs(q.h - list[0].h); return Math.min(dh, 15 - dh) >= 2; }) || list[1] || list[0];
    return [list[0].c, second.c];
  }

  // ------------------------------------------------------------ textos de anuncio
  function copies(b) {
    var T = lines(b.titulares), B = lines(b.beneficios), out = [];
    var hooks = [T[0] || b.nombre, '¿Buscás ' + (T[1] || 'una atención rápida').toLowerCase().replace(/\.$/, '') + '?', b.dato + ' ' + b.datoTxt + '.', 'Esto dicen quienes ya nos eligieron:'];
    out.push(['Directo', hooks[0] + ' ✅\n\n' + b.bajada + '\n\n👉 ' + b.cta + '.']);
    out.push(['Pregunta', hooks[1] + '\n\nEn ' + b.nombre + ':\n' + B.map(function (x) { return '✔️ ' + x; }).join('\n') + '\n\n👉 ' + b.cta + '.']);
    out.push(['Número', '⏱️ ' + hooks[2] + '\n\n' + (T[2] || b.bajada) + '.\n\n👉 ' + b.cta + '.']);
    out.push(['Testimonio', hooks[3] + '\n\n⭐⭐⭐⭐⭐ «' + b.testimonio + '» — ' + b.autor + '\n\n👉 ' + b.cta + '.']);
    out.push(['Corto', (T[0] || b.nombre) + '. ' + (B[0] || '') + '. ' + b.cta + ' 👇']);
    return out;
  }

  // ------------------------------------------------------------ generación
  function plan(b, nPhotos) {
    // Qué sale en cada tanda: el gancho prueba los 3 titulares; el resto usa uno distinto cada uno.
    var T = lines(b.titulares).slice(0, 3), out = [], i = 0, solo = Object.keys(TPL).filter(function (k) { return UI.tpl[k]; }).length === 1;
    Object.keys(TPL).forEach(function (t) {
      if (!UI.tpl[t]) return;
      if (t === 'foto') { for (var p = 0; p < nPhotos; p++) out.push({ tpl: t, text: T[p % T.length], n: p + 1, photo: p }); return; }
      if (t === 'gancho' || solo) { T.forEach(function (tx, k) { out.push({ tpl: t, text: tx, n: k + 1 }); }); return; }
      i++; out.push({ tpl: t, text: T[i % T.length], n: (i % 3) + 1 });
    });
    return out;
  }
  async function generate() {
    var b = C(), logo = await logoImg(b.logo), photos = [];
    if (!lines(b.titulares).length) { toast('Escribí al menos un titular en la marca'); return; }
    for (var r = 0; r < Math.min(3, refsOf(b).length); r++) { var im = await logoImg(refsOf(b)[r]); if (im) photos.push(im); }
    await PIEZAS.fontsReady();
    var out = [];
    plan(b, photos.length).forEach(function (pl) {
      estilos(b).forEach(function (es) {
        Object.keys(FMT).forEach(function (f) {
          if (!UI.fmt[f]) return;
          var ph = pl.tpl === 'foto' ? photos[pl.photo] : pl.tpl === 'notif' ? (photos[0] || null) : null;
          out.push({ tpl: pl.tpl, fmt: f, text: pl.text, n: pl.n, estilo: es, cv: PIEZAS.draw(document.createElement('canvas'), b, { tpl: pl.tpl, fmt: f, text: pl.text, n: pl.n, estilo: es, logo: logo, photo: ph }) });
        });
      });
    });
    UI.out = out; UI.copies = copies(b);
    render(); toast(out.length + ' piezas generadas');
  }
  function fname(p) { return slug(C().nombre) + '-' + slug(TPL[p.tpl]) + '-v' + p.n + '-' + p.estilo + '-' + p.fmt + '.png'; }
  function dl(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function toBlob(cv) { return new Promise(function (ok) { cv.toBlob(ok, 'image/png'); }); }
  function thumb(cv) { var t = document.createElement('canvas'), s = 420 / Math.max(cv.width, cv.height); t.width = Math.round(cv.width * s); t.height = Math.round(cv.height * s); t.getContext('2d').drawImage(cv, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', .82); }
  function addToLib(p) {
    C().lib.unshift({ id: Date.now() + Math.random().toString(36).slice(2, 6), nombre: TPL[p.tpl] + ' v' + p.n + ' · ' + ESTILOS[p.estilo].toLowerCase(), tpl: p.tpl, fmt: p.fmt, estado: 'nuevo', gasto: 0, res: 0, dias: 0, img: thumb(p.cv), fecha: new Date().toISOString().slice(0, 10) });
    save();
  }

  // ------------------------------------------------------------ biblioteca de ejemplo
  async function seed() {
    var any = Object.keys(DB.clients).some(function (k) { return DB.clients[k].lib.length; });
    if (any) return;
    await PIEZAS.fontsReady();
    var demo = { norte: [['chat', 'oscuro', 'ganador', 412, 168, 21], ['gancho', 'claro', 'ganador', 260, 121, 14], ['vs', 'oscuro', 'activo', 188, 61, 9], ['resena', 'claro', 'activo', 96, 35, 6], ['dato', 'oscuro', 'cansado', 295, 74, 26], ['pasos', 'claro', 'pausado', 60, 9, 4]],
      delta: [['notif', 'oscuro', 'ganador', 520, 233, 18], ['gancho', 'oscuro', 'activo', 140, 52, 7]], litoral: [['dato', 'claro', 'cansado', 380, 61, 31], ['gancho', 'oscuro', 'cansado', 210, 33, 24]], sur: [] };
    Object.keys(demo).forEach(function (k) {
      var b = DB.clients[k], T = lines(b.titulares);
      demo[k].forEach(function (d, i) {
        var cv = PIEZAS.draw(document.createElement('canvas'), b, { tpl: d[0], fmt: '1x1', text: T[i % T.length], n: (i % 3) + 1, estilo: d[1] });
        b.lib.push({ id: k + i, nombre: TPL[d[0]] + ' · ' + d[1], tpl: d[0], fmt: '1x1', estado: d[2], gasto: d[3], res: d[4], dias: d[5], img: thumb(cv), fecha: '2026-11-' + String(10 + i).padStart(2, '0') });
      });
    });
    save();
  }

  // ------------------------------------------------------------ vista
  var MARK = '<span class="mark"><svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2 12 6 7l3 3 5-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  var IC = {
    brush: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-9 9H5v-6z"/><path d="M12 6l6 6"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 6h14M5 11h14M5 16h9"/></svg>',
    lib: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  };
  function needs(b) {
    var act = b.lib.filter(function (x) { return x.estado === 'activo' || x.estado === 'ganador'; }).length;
    var tired = b.lib.filter(function (x) { return x.estado === 'cansado'; }).length;
    return { act: act, tired: tired, alert: tired > 0 || act < 3 };
  }
  function render() {
    var b = C();
    var h = '<div class="wrap"><div class="top"><div class="brand">' + MARK + 'PanelPro</div><nav class="nav" aria-label="Secciones"><a href="index.html#admin">Clientes</a><a href="index.html#agencia">Agencia</a><span aria-current="page">Banco creativo</span></nav><div class="who"><span class="chip demo">Vista previa</span><span class="chip admin">Admin</span></div></div>';
    h += '<div class="head"><div><span class="lbl">Anuncios de todos tus clientes</span><h1>Banco creativo</h1><p class="range">Generá piezas con la marca de cada cliente y seguí cuáles rinden</p></div></div>';
    h += '<div class="tabs" role="group" aria-label="Cliente">' + Object.keys(DB.clients).map(function (k) { var c = DB.clients[k], nd = needs(c); return '<button data-c="' + k + '" aria-pressed="' + (DB.sel === k) + '" style="--dot:' + c.c1 + '"><i></i>' + esc(c.nombre) + (nd.alert ? '<span class="n">renovar</span>' : '') + '</button>'; }).join('') + '<button id="addc">+ Cliente</button></div>';
    h += '<div class="steps"><button data-s="marca" aria-pressed="' + (UI.step === 'marca') + '">1 · Marca<small>Logo, colores y textos</small></button><button data-s="gen" aria-pressed="' + (UI.step === 'gen') + '">2 · Generar<small>Piezas y textos en serie</small></button><button data-s="lib" aria-pressed="' + (UI.step === 'lib') + '">3 · Biblioteca<small>Qué rinde y qué renovar</small></button></div>';
    if (UI.step === 'marca') h += marca(b); else if (UI.step === 'gen') h += gen(b); else h += lib(b);
    h += '<p class="watermark">Vista previa · las piezas se generan en tu navegador · PanelPro</p></div>';
    app.innerHTML = h;
    bind(b);
  }
  function marca(b) {
    function sec(t, d) { return '<div class="kit-sec"><h3>' + t + '</h3>' + (d ? '<p>' + d + '</p>' : '') + '</div>'; }
    function f(k, l, help, ta) { return '<label class="field' + (ta ? ' full' : '') + '">' + l + (ta ? '<textarea data-k="' + k + '">' + esc(b[k]) + '</textarea>' : '<input data-k="' + k + '" value="' + esc(b[k]) + '">') + (help ? '<small class="help">' + help + '</small>' : '') + '</label>'; }
    return '<article class="card" style="--c:var(--violet)"><div class="ch"><span class="ico">' + IC.brush + '</span><div><h2>Marca de ' + esc(b.nombre) + '</h2><p class="sub">Se carga una sola vez. Todo lo que generes sale con estos datos.</p></div></div><div class="kit">' +
      f('nombre', 'Nombre de la marca') +
      '<div class="field">Logo<div class="logo-up"><span class="pv">' + (b.logo ? '<img src="' + b.logo + '" alt="">' : 'Sin logo') + '</span><label class="btn sm">Subir logo<input type="file" id="logo" accept="image/*" hidden></label>' + (b.logo ? '<button class="btn sm" id="nologo">Quitar</button>' : '') + '</div><small class="help">PNG con fondo transparente, idealmente.</small></div>' +
      '<div class="field">Colores<div class="colors"><input type="color" data-k="c1" value="' + b.c1 + '"><input type="color" data-k="c2" value="' + b.c2 + '"><small class="help">Principal y secundario</small></div></div>' +
      '<div class="field full">Imágenes de referencia<small class="help">Fotos o anuncios del cliente que muestran el estilo que querés: su local, su equipo, capturas, anuncios que ya funcionaron. Se usan en las plantillas con foto y para tomar los colores. Hasta 6.</small>' +
        '<div class="refs">' + refsOf(b).map(function (r, i) { return '<div class="ref"><img src="' + r + '" alt="Referencia ' + (i + 1) + '"><button type="button" class="rm" data-rmref="' + i + '" aria-label="Quitar referencia ' + (i + 1) + '">×</button>' + (i < 3 ? '<span>Se usa</span>' : '') + '</div>'; }).join('') +
        (refsOf(b).length < 6 ? '<label class="ref add">+<span>Agregar</span><input type="file" id="refs" accept="image/*" multiple hidden></label>' : '') + '</div>' +
        (refsOf(b).length ? '<div><button type="button" class="btn sm" id="pal">Tomar los colores de las referencias</button></div>' : '') + '</div>' +
      '<div class="field">Estilo de las piezas<div class="picks" style="margin-top:0">' + Object.keys(ESTILOS).map(function (k) { return '<button type="button" class="pick" data-estilo="' + k + '" aria-pressed="' + ((b.estilo || 'ambos') === k) + '">' + ESTILOS[k] + '</button>'; }).join('') + '</div><small class="help">"Los dos" genera cada pieza en versión oscura y clara para probar cuál rinde más.</small></div>' +
      sec('Mensaje principal', 'Escribí entre asteriscos la parte que querés resaltar: Te respondemos en *menos de 5 minutos*.') +
      f('titulares', 'Titulares', 'Uno por renglón. Se usan los 3 primeros: cada uno sale como una variante distinta.', true) +
      f('bajada', 'Bajada (frase debajo del titular)') + f('cta', 'Botón (llamado a la acción)') + f('sello', 'Sello (ej: Atención 24/7)', 'Va en una etiqueta girada. Dejalo vacío si no querés.') +
      f('beneficios', 'Beneficios', 'Uno por renglón, hasta 4. Se usan en el gancho y en la comparación.', true) +
      sec('Conversación de WhatsApp', 'Así se ve la charla en la pieza "Conversación".') +
      f('chatQ', 'Mensaje del cliente') + f('chatA', 'Respuesta de la marca') + f('chatQ2', 'Segundo mensaje del cliente') + f('chatA2', 'Segunda respuesta') + f('nota', 'Nota escrita a mano (ej: ¡En 2 minutos!)') +
      sec('Prueba y confianza', '') +
      f('testimonio', 'Testimonio de un cliente', 'Usá uno real: los clientes detectan los inventados.', true) + f('autor', 'Quién lo dice') +
      f('dato', 'Número destacado (ej: 2 min, 24/7)') + f('datoTxt', 'Texto del número', 'Podés resaltar con asteriscos.') +
      sec('Comparación, pasos y notificaciones', '') +
      f('otros', 'Cómo lo hacen los demás', 'Uno por renglón: va en la columna "Otros" de la comparación.', true) +
      f('pasos', 'Pasos', 'Tres renglones: cómo empieza alguien con vos.', true) +
      f('notifs', 'Notificaciones', 'Un mensaje por renglón.', true) +
      '</div><div class="gen-bar"><span class="muted" style="font-size:13px">Revisá que los textos cumplan las políticas de publicidad de Meta.</span><button class="btn pri" data-s="gen">Guardar y generar →</button></div></article>';
  }
  function gen(b) {
    var h = aiCard(b) + '<article class="card" style="--c:var(--green)"><div class="ch"><span class="ico">' + IC.spark + '</span><div><h2>Generar piezas para ' + esc(b.nombre) + '</h2><p class="sub">Formatos probados en anuncios de respuesta directa, con la marca del cliente.</p></div></div>' +
      '<span class="lbl" style="display:block;margin-top:16px">Plantillas</span>' + (refsOf(b).length ? '' : '<p class="muted" style="font-size:13px;margin:6px 0 0">La plantilla Foto necesita imágenes de referencia. <button class="link" data-s="marca">Agregalas en la marca</button></p>') + '<div class="tplgrid">' + Object.keys(TPL).map(function (k) { var dis = PIEZAS.TPL[k].foto && !refsOf(b).length; return '<button class="tplpick" data-tpl="' + k + '" aria-pressed="' + (!!UI.tpl[k] && !dis) + '"' + (dis ? ' disabled' : '') + '><b>' + TPL[k] + '</b><small>' + PIEZAS.TPL[k].d + '</small></button>'; }).join('') + '</div>' +
      '<span class="lbl" style="display:block;margin-top:16px">Estilo</span><div class="picks">' + Object.keys(ESTILOS).map(function (k) { return '<button class="pick" data-estilo="' + k + '" aria-pressed="' + ((b.estilo || 'ambos') === k) + '">' + ESTILOS[k] + '</button>'; }).join('') + '</div>' +
      '<span class="lbl" style="display:block;margin-top:16px">Formatos</span><div class="picks">' + Object.keys(FMT).map(function (k) { return '<button class="pick" data-fmt="' + k + '" aria-pressed="' + !!UI.fmt[k] + '">' + FMT[k][2] + ' · ' + FMT[k][3] + '</button>'; }).join('') + '</div>' +
      '<div class="gen-bar"><span class="muted" style="font-size:13.5px">' + count() + ' piezas por tanda</span><div class="actions">' + (UI.out.length ? '<button class="btn" id="zip">' + IC.dl + ' Descargar todo (.zip)</button><button class="btn" id="saveall">Guardar todo en biblioteca</button>' : '') + '<button class="btn pri" id="go">' + IC.spark + ' Generar</button></div></div>';
    if (UI.out.length) h += '<div class="out" id="out"></div>';
    h += '</article>';
    if (UI.copies.length) h += '<article class="card" style="--c:var(--blue);margin-top:14px"><div class="ch"><span class="ico">' + IC.text + '</span><div><h2>Textos para el anuncio</h2><p class="sub">Cinco ángulos distintos para probar. Copiás y pegás en Meta.</p></div></div><div class="copies">' +
      UI.copies.map(function (c, i) { return '<div class="copy"><div><small>' + c[0] + '</small><p>' + esc(c[1]) + '</p></div><button class="btn sm" data-copy="' + i + '">Copiar</button></div>'; }).join('') + '</div></article>';
    return h;
  }
  // ------------------------------------------------------------ imágenes con IA (OpenAI)
  var AI_SIZES = { '1024x1024': 'Cuadrada', '1024x1536': 'Vertical', '1536x1024': 'Horizontal' };
  var AI_Q = { low: ['Borrador', 'unos US$ 0,02 c/u'], medium: ['Normal', 'unos US$ 0,05 c/u'], high: ['Alta', 'unos US$ 0,20 c/u'] };
  function aiCard(b) {
    var A = UI.ai, R = refsOf(b);
    var h = '<article class="card ai" style="--c:var(--violet);margin-bottom:14px"><div class="ch"><span class="ico">' + IC.spark + '</span><div><h2>Imágenes con IA</h2><p class="sub">ChatGPT crea fotos nuevas para ' + esc(b.nombre) + ', guiándose por sus referencias. Después las usás en las plantillas.</p></div></div>';
    if (!SB) h += '<p class="ai-note">Vista previa: la generación con IA funciona cuando el banco creativo está en tu Netlify y conectado a tu Supabase.</p>';
    h += '<label class="field" style="margin-top:14px">Qué querés en la imagen<textarea id="ai_p" rows="3" placeholder="Ej: persona joven sonriendo mientras mira el celular, de noche en la ciudad, luces cálidas, estilo foto real">' + esc(A.prompt) + '</textarea></label>';
    if (R.length) h += '<span class="lbl" style="display:block;margin-top:14px">Referencias que usa (hasta 3)</span><div class="refs">' + R.map(function (r, i) { var on = A.sel.indexOf(i) > -1; return '<button type="button" class="ref pickref" data-aref="' + i + '" aria-pressed="' + on + '" aria-label="Usar referencia ' + (i + 1) + '"><img src="' + r + '" alt="">' + (on ? '<span>Usa</span>' : '') + '</button>'; }).join('') + '</div>';
    else h += '<p class="muted" style="font-size:13px;margin:10px 0 0">Sin referencias, la IA crea desde cero. Para que respete el estilo del cliente, <button class="link" data-s="marca">subí referencias en la marca</button>.</p>';
    h += '<div class="ai-opts"><label class="field">Formato<select id="ai_s">' + Object.keys(AI_SIZES).map(function (k) { return '<option value="' + k + '"' + (k === A.size ? ' selected' : '') + '>' + AI_SIZES[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">Cantidad<select id="ai_n">' + [1, 2, 3, 4].map(function (k) { return '<option' + (k === A.n ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">Calidad<select id="ai_q">' + Object.keys(AI_Q).map(function (k) { return '<option value="' + k + '"' + (k === A.q ? ' selected' : '') + '>' + AI_Q[k][0] + ' · ' + AI_Q[k][1] + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="ai-chk"><input type="checkbox" id="ai_t"' + (A.noText !== false ? ' checked' : '') + '> Sin textos dentro de la imagen (los pone la plantilla)</label>' +
      '<div class="gen-bar"><span class="muted" style="font-size:13px">' + (A.busy ? 'Generando… puede tardar hasta un minuto.' : 'Revisá que la imagen cumpla las políticas de Meta antes de usarla.') + '</span><button class="btn pri" id="ai_go"' + (A.busy || !SB ? ' disabled' : '') + '>' + (A.busy ? '<span class="spin"></span> Generando' : IC.spark + ' Generar con IA') + '</button></div>';
    if (A.err) h += '<p class="err" role="alert" style="margin-top:10px">' + esc(A.err) + '</p>';
    if (A.imgs.length) h += '<div class="out">' + A.imgs.map(function (src, i) { return '<div class="piece"><div class="cv"><img src="' + src + '" alt="Imagen generada ' + (i + 1) + '" style="max-width:100%;max-height:230px;border-radius:6px"></div><div class="meta"><b>Imagen IA ' + (i + 1) + '</b><div class="acts"><button class="btn sm" data-aidl="' + i + '">Descargar</button><button class="btn sm pri" data-aiuse="' + i + '">Usar</button></div></div></div>'; }).join('') + '</div>';
    return h + '</article>';
  }
  function aiPrompt(b, raw, hasRefs, noText) {
    return 'Imagen fotográfica para un anuncio de Facebook e Instagram de la marca "' + b.nombre + '". ' + raw.trim().replace(/[.!\s]*$/, '.') +
      (hasRefs ? ' Usá las imágenes adjuntas como referencia de estilo: respetá su paleta de colores, la iluminación, el tipo de escena y la estética general.' : '') +
      ' Paleta de la marca: ' + b.c1 + ' y ' + b.c2 + '.' + (noText ? ' No incluyas textos, letras, números ni logos dentro de la imagen.' : '') +
      ' Dejá espacio libre en la parte inferior para superponer un titular. Calidad profesional, nítida, lista para publicidad.';
  }
  async function runAI(b) {
    var A = UI.ai, R = refsOf(b);
    if (A.prompt.trim().length < 5) { A.err = 'Describí qué querés en la imagen.'; render(); return; }
    var refs = A.sel.filter(function (i) { return R[i]; }).slice(0, 3).map(function (i) { return R[i]; });
    A.busy = true; A.err = ''; render();
    try {
      var r = await SB.functions.invoke('generar-imagen', { body: { prompt: aiPrompt(b, A.prompt, refs.length > 0, A.noText !== false), refs: refs, size: A.size, quality: A.q, n: A.n } });
      var msg = null;
      if (r.error) { try { msg = (await r.error.context.json()).error; } catch (e) { msg = 'No se pudo conectar con la IA. Revisá que la función generar-imagen esté publicada.'; } }
      else if (!r.data || !r.data.images || !r.data.images.length) msg = (r.data && r.data.error) || 'La IA no devolvió imágenes. Probá de nuevo.';
      if (msg) A.err = msg; else { A.imgs = r.data.images.concat(A.imgs).slice(0, 12); toast(r.data.images.length === 1 ? 'Imagen lista' : r.data.images.length + ' imágenes listas'); }
    } catch (e) { A.err = 'No se pudo conectar con la IA. Revisá tu conexión.'; }
    A.busy = false; render();
  }
  function useAI(b, src) {
    var im = new Image();
    im.onload = function () { var s = Math.min(1, 1080 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      b.refs.unshift(c.toDataURL('image/jpeg', .85)); if (b.refs.length > 6) b.refs.length = 6; UI.ai.sel = UI.ai.sel.map(function (i) { return i + 1; }).filter(function (i) { return i < 6; });
      save(); UI.tpl.foto = UI.tpl.marco = true; render(); toast('Agregada a las referencias: ya sale en las plantillas con foto'); };
    im.src = src;
  }

  function count() { var ph = Math.min(3, refsOf(C()).length); return plan(C(), ph).length * estilos(C()).length * Object.keys(FMT).filter(function (k) { return UI.fmt[k]; }).length; }
  function lib(b) {
    var nd = needs(b), list = b.lib.filter(function (x) { return UI.filter === 'todos' || x.estado === UI.filter; });
    var h = '<article class="card" style="--c:var(--amber)"><div class="ch"><span class="ico">' + IC.lib + '</span><div><h2>Biblioteca de ' + esc(b.nombre) + '</h2><p class="sub">' + b.lib.length + ' piezas · ' + nd.act + ' en circulación</p></div></div>';
    if (nd.alert) h += '<div class="lib-alert">⚠️ <span>' + (nd.tired ? '<b>' + nd.tired + (nd.tired === 1 ? ' anuncio cansado' : ' anuncios cansados') + '.</b> ' : '') + (nd.act < 3 ? 'Solo ' + nd.act + ' en circulación (conviene tener al menos 3). ' : '') + 'Es momento de generar piezas nuevas.</span><button class="btn sm pri" data-s="gen">Generar</button></div>';
    h += '<div class="filters">' + ['todos'].concat(EST).map(function (e) { var c = e === 'todos' ? b.lib.length : b.lib.filter(function (x) { return x.estado === e; }).length; return '<button class="pick" data-f="' + e + '" aria-pressed="' + (UI.filter === e) + '">' + (e === 'todos' ? 'Todos' : ESTL[e]) + ' (' + c + ')</button>'; }).join('') + '</div>';
    if (!list.length) h += '<div class="empty-lib">' + (b.lib.length ? 'No hay piezas con este estado.' : 'Todavía no hay piezas. Generá las primeras y guardalas acá.') + '</div>';
    else h += '<div class="lib">' + list.sort(function (a, c) { var O = ['ganador', 'activo', 'nuevo', 'cansado', 'pausado'], d = O.indexOf(a.estado) - O.indexOf(c.estado); return d || (c.res / (c.gasto || 1)) - (a.res / (a.gasto || 1)); }).map(function (x) {
      var cpr = x.res ? x.gasto / x.res : null;
      return '<div class="piece"><div class="cv"><img src="' + x.img + '" alt="' + esc(x.nombre) + '" style="max-width:100%;max-height:100%;border-radius:6px"></div><div class="meta"><span class="est ' + x.estado + '">' + ESTL[x.estado] + '</span><b>' + esc(x.nombre) + '</b><span>' + FMT[x.fmt][2] + ' · ' + (x.dias ? x.dias + ' días en circulación' : 'sin publicar') + '</span>' +
        '<div class="kpis3"><div>Gasto<b>' + (x.gasto ? 'US$ ' + Math.round(x.gasto).toLocaleString('es-AR') : '—') + '</b></div><div>Resultados<b>' + (x.res || '—') + '</b></div><div>Costo<b>' + (cpr ? usd(cpr) : '—') + '</b></div></div>' +
        '<select data-est="' + x.id + '" aria-label="Estado">' + EST.map(function (e) { return '<option value="' + e + '"' + (e === x.estado ? ' selected' : '') + '>' + ESTL[e] + '</option>'; }).join('') + '</select>' + ((x.estado === 'ganador' || x.estado === 'activo') && x.tpl ? '<button class="btn sm pri" data-vari="' + x.id + '">Hacer variantes</button>' : '') + '</div></div>';
    }).join('') + '</div>';
    h += '<p class="muted" style="font-size:12.5px;margin-top:14px">Por ahora el estado lo marcás vos. Cuando conectemos el centro de control con Meta, el gasto, los resultados y el estado se completan solos.</p></article>';
    return h;
  }

  function bind(b) {
    if ($('#ai_p')) {
      $('#ai_p').oninput = function () { UI.ai.prompt = this.value; };
      $('#ai_s').onchange = function () { UI.ai.size = this.value; };
      $('#ai_n').onchange = function () { UI.ai.n = +this.value; };
      $('#ai_q').onchange = function () { UI.ai.q = this.value; };
      $('#ai_t').onchange = function () { UI.ai.noText = this.checked; };
      $$('[data-aref]').forEach(function (x) { x.onclick = function () { var i = +x.dataset.aref, k = UI.ai.sel.indexOf(i); if (k > -1) UI.ai.sel.splice(k, 1); else if (UI.ai.sel.length < 3) UI.ai.sel.push(i); else { toast('Máximo 3 referencias'); return; } render(); }; });
      if ($('#ai_go')) $('#ai_go').onclick = function () { runAI(b); };
      $$('[data-aidl]').forEach(function (x) { x.onclick = async function () { var r = await fetch(UI.ai.imgs[x.dataset.aidl]); dl(await r.blob(), slug(b.nombre) + '-ia-' + (+x.dataset.aidl + 1) + '.png'); }; });
      $$('[data-aiuse]').forEach(function (x) { x.onclick = function () { useAI(b, UI.ai.imgs[x.dataset.aiuse]); }; });
    }
    $$('[data-c]').forEach(function (x) { x.onclick = function () { DB.sel = x.dataset.c; UI.out = []; UI.copies = []; UI.ai.imgs = []; UI.ai.err = ''; UI.ai.sel = [0, 1, 2]; save(); render(); }; });
    $$('[data-s]').forEach(function (x) { x.onclick = function () { UI.step = x.dataset.s; render(); if (UI.step === 'gen' && x.closest('.gen-bar')) generate(); }; });
    $('#addc').onclick = function () { var n = prompt('Nombre del cliente'); if (!n) return; var k = slug(n) || 'c' + Date.now(); DB.clients[k] = brand(n.trim(), '#2b4dff', '#38d9f0'); DB.sel = k; UI.step = 'marca'; save(); render(); };
    $$('[data-k]').forEach(function (i) { i.oninput = function () { b[i.dataset.k] = i.value; save(); if (i.dataset.k === 'nombre') $$('[data-c="' + DB.sel + '"]').forEach(function (t) { t.lastChild.nodeType === 3 ? (t.lastChild.textContent = i.value) : 0; }); }; });
    if ($('#logo')) $('#logo').onchange = function () { var f = this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { var im = new Image(); im.onload = function () { var c = document.createElement('canvas'), s = Math.min(1, 400 / Math.max(im.width, im.height)); c.width = im.width * s; c.height = im.height * s; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); b.logo = c.toDataURL('image/png'); save(); render(); }; im.src = r.result; }; r.readAsDataURL(f); };
    if ($('#refs')) $('#refs').onchange = async function () {
      var files = Array.prototype.slice.call(this.files, 0, 6 - refsOf(b).length);
      for (var i = 0; i < files.length; i++) { var d = await shrink(files[i], 1080, .78); if (d) b.refs.push(d); }
      save(); render(); toast(files.length === 1 ? 'Referencia agregada' : files.length + ' referencias agregadas');
    };
    $$('[data-rmref]').forEach(function (x) { x.onclick = function () { b.refs.splice(+x.dataset.rmref, 1); save(); render(); }; });
    if ($('#pal')) $('#pal').onclick = async function () { var p = await palette(refsOf(b)); if (!p) { toast('No encontré colores marcados en las referencias'); return; } b.c1 = p[0]; b.c2 = p[1]; save(); render(); toast('Colores tomados de las referencias'); };
    if ($('#nologo')) $('#nologo').onclick = function () { b.logo = ''; save(); render(); };
    $$('[data-tpl]').forEach(function (x) { x.onclick = function () { UI.tpl[x.dataset.tpl] = !UI.tpl[x.dataset.tpl]; render(); }; });
    $$('[data-estilo]').forEach(function (x) { x.onclick = function () { b.estilo = x.dataset.estilo; save(); render(); }; });
    $$('[data-vari]').forEach(function (x) { x.onclick = function () { var it = b.lib.find(function (y) { return y.id === x.dataset.vari; }); if (!it || !it.tpl) return; Object.keys(UI.tpl).forEach(function (k) { UI.tpl[k] = k === it.tpl; }); UI.step = 'gen'; render(); generate(); toast('Generando variantes de este ganador'); }; });
    $$('[data-fmt]').forEach(function (x) { x.onclick = function () { UI.fmt[x.dataset.fmt] = !UI.fmt[x.dataset.fmt]; render(); }; });
    if ($('#go')) $('#go').onclick = function () { if (!count()) { toast('Elegí al menos una plantilla y un formato'); return; } generate(); };
    if ($('#out')) {
      var out = $('#out');
      UI.out.forEach(function (p, i) {
        var d = document.createElement('div'); d.className = 'piece';
        d.innerHTML = '<div class="cv"></div><div class="meta"><b>' + TPL[p.tpl] + ' · v' + p.n + '</b><span>' + FMT[p.fmt][2] + '</span><div class="acts"><button class="btn sm" data-dl="' + i + '">Descargar</button><button class="btn sm" data-keep="' + i + '">Guardar</button></div></div>';
        $('.cv', d).appendChild(p.cv); out.appendChild(d);
      });
      $$('[data-dl]').forEach(function (x) { x.onclick = async function () { var p = UI.out[x.dataset.dl]; dl(await toBlob(p.cv), fname(p)); }; });
      $$('[data-keep]').forEach(function (x) { x.onclick = function () { addToLib(UI.out[x.dataset.keep]); x.disabled = true; x.textContent = 'Guardada'; toast('Guardada en la biblioteca'); }; });
    }
    if ($('#zip')) $('#zip').onclick = async function () {
      if (!window.JSZip) { toast('No se pudo cargar el compresor; descargalas de a una'); return; }
      var z = new JSZip(); for (var i = 0; i < UI.out.length; i++) z.file(fname(UI.out[i]), await toBlob(UI.out[i].cv));
      z.file(slug(b.nombre) + '-textos.txt', UI.copies.map(function (c) { return '== ' + c[0] + ' ==\n' + c[1]; }).join('\n\n'));
      dl(await z.generateAsync({ type: 'blob' }), slug(b.nombre) + '-anuncios.zip'); toast('Descargando ' + UI.out.length + ' piezas');
    };
    if ($('#saveall')) $('#saveall').onclick = function () { UI.out.forEach(addToLib); toast(UI.out.length + ' piezas guardadas'); UI.step = 'lib'; render(); };
    $$('[data-copy]').forEach(function (x) { x.onclick = function () { var t = UI.copies[x.dataset.copy][1]; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Texto copiado'); }, function () { toast('Seleccioná el texto y copialo'); }); }; });
    $$('[data-f]').forEach(function (x) { x.onclick = function () { UI.filter = x.dataset.f; render(); }; });
    $$('[data-est]').forEach(function (s) { s.onchange = function () { var it = b.lib.find(function (x) { return x.id === s.dataset.est; }); it.estado = s.value; save(); render(); toast('Estado actualizado'); }; });
  }

  seed().then(function () { render(); generate(); });
})();
