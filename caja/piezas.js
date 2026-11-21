// Motor de piezas PanelPro: dibuja anuncios en canvas a partir de la marca de un cliente.
// Formatos de respuesta directa (gancho, conversación, reseña, comparación, pasos, número, foto, notificaciones),
// en versión oscura y clara, con zonas seguras para Historias y Reels.
(function () {
  'use strict';

  var FMT = { '1x1': [1080, 1080, 'Cuadrado 1:1', 'Feed'], '4x5': [1080, 1350, 'Vertical 4:5', 'Feed'], '9x16': [1080, 1920, 'Historia 9:16', 'Historias y Reels'] };
  var TPL = {
    gancho: { n: 'Gancho', d: 'Titular fuerte con palabra resaltada' },
    chat: { n: 'Conversación', d: 'Chat de WhatsApp con respuesta rápida' },
    resena: { n: 'Reseña', d: 'Testimonio de un cliente con estrellas' },
    vs: { n: 'Nosotros vs. otros', d: 'Comparación lado a lado' },
    pasos: { n: 'Cómo funciona', d: 'Tres pasos simples' },
    dato: { n: 'Número', d: 'Un dato grande que llama la atención' },
    foto: { n: 'Foto', d: 'Foto del cliente con titular', foto: true },
    notif: { n: 'Notificaciones', d: 'Mensajes entrando en el celular' },
  };
  var DISPLAY = '"Inter Tight", Inter, system-ui, sans-serif', BODY = 'Inter, system-ui, sans-serif', HAND = 'Caveat, "Comic Sans MS", cursive';

  // ------------------------------------------------------------ color
  function rgb(h) { var n = parseInt(String(h || '#000000').slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
  function hex(c) { return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
  function lum(h) { var c = rgb(h); return (.2126 * c[0] + .7152 * c[1] + .0722 * c[2]) / 255; }
  function rgba(h, a) { var c = rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function onColor(h) { return lum(h) > .62 ? '#0b0f17' : '#ffffff'; }
  function toward(h, target) { var L = lum(h); if (L >= target) return h; var t = Math.min(1, (target - L) / (1 - L) + .06); return mix(h, '#ffffff', t); }
  function deep(h, target) { var L = lum(h); if (L <= target) return h; return mix(h, '#000000', Math.min(.85, (L - target) / L + .05)); }

  function theme(b, estilo) {
    var c1 = b.c1 || '#2b4dff', c2 = b.c2 || '#38d9f0';
    if (estilo === 'claro') {
      var acc = deep(c1, .42);
      return { dark: false, c1: c1, c2: c2, acc: acc, accText: onColor(acc), bg: mix('#f4f5f7', c1, .035), bg2: mix('#ffffff', c1, .02), ink: '#0b0f17', muted: '#4b5466', soft: 'rgba(11,15,23,.06)', line: 'rgba(11,15,23,.10)', card: '#ffffff', glow: rgba(c1, .10), sticker: toward(c2, .72), stickerText: '#0b0f17' };
    }
    var a2 = toward(c2, .62);
    return { dark: true, c1: c1, c2: c2, acc: c1, accText: onColor(c1), bg: mix('#07090e', c1, .07), bg2: mix('#0d1119', c1, .09), ink: '#f5f7fb', muted: 'rgba(245,247,251,.66)', soft: 'rgba(255,255,255,.06)', line: 'rgba(255,255,255,.11)', card: mix('#121722', c1, .06), glow: rgba(c1, .30), light2: a2, sticker: a2, stickerText: onColor(a2) };
  }

  // ------------------------------------------------------------ primitivas
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function font(ctx, w, s, fam) { ctx.font = w + ' ' + s + 'px ' + (fam || DISPLAY); try { ctx.letterSpacing = (fam === BODY || fam === HAND ? 0 : -s * .025) + 'px'; } catch (e) {} }
  function spaced(ctx, px) { try { ctx.letterSpacing = px + 'px'; } catch (e) {} }
  function shadow(ctx, blur, y, a) { ctx.shadowColor = 'rgba(0,0,0,' + a + ')'; ctx.shadowBlur = blur; ctx.shadowOffsetY = y; ctx.shadowOffsetX = 0; }
  function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  function cover(ctx, img, x, y, w, h, fy) { var s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s; ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) * (fy == null ? .5 : fy), iw, ih); }

  var grainC = null;
  function grain() {
    if (grainC) return grainC;
    grainC = document.createElement('canvas'); grainC.width = grainC.height = 220;
    var g = grainC.getContext('2d'), d = g.createImageData(220, 220), seed = 11;
    for (var i = 0; i < d.data.length; i += 4) { seed = (seed * 16807) % 2147483647; var v = seed % 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); return grainC;
  }
  function background(ctx, W, H, t, variant) {
    ctx.fillStyle = t.bg; ctx.fillRect(0, 0, W, H);
    if (t.dark) {
      var g1 = ctx.createRadialGradient(W * (variant % 2 ? .15 : .9), H * .05, 0, W * (variant % 2 ? .15 : .9), H * .05, W * 1.05); g1.addColorStop(0, rgba(t.c1, .42)); g1.addColorStop(1, rgba(t.c1, 0)); ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
      var g2 = ctx.createRadialGradient(W * (variant % 2 ? .95 : .05), H * .98, 0, W * (variant % 2 ? .95 : .05), H * .98, W * .9); g2.addColorStop(0, rgba(t.c2, .20)); g2.addColorStop(1, rgba(t.c2, 0)); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    } else {
      var g3 = ctx.createRadialGradient(W * .92, 0, 0, W * .92, 0, W * .9); g3.addColorStop(0, rgba(t.c1, .10)); g3.addColorStop(1, rgba(t.c1, 0)); ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H);
    }
    // grilla muy sutil para dar textura de "pieza diseñada"
    ctx.save(); ctx.globalAlpha = t.dark ? .035 : .045; ctx.strokeStyle = t.dark ? '#ffffff' : '#0b0f17'; ctx.lineWidth = 1;
    for (var x = 60; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); }
    for (var y = 60; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }
    ctx.restore();
    var mask = ctx.createRadialGradient(W / 2, H / 2, W * .2, W / 2, H / 2, Math.max(W, H) * .75); mask.addColorStop(0, rgba(t.bg, 0)); mask.addColorStop(1, rgba(t.bg, .85)); ctx.fillStyle = mask; ctx.fillRect(0, 0, W, H);
  }
  function addGrain(ctx, W, H, t) { ctx.save(); ctx.globalAlpha = t.dark ? .07 : .05; ctx.globalCompositeOperation = t.dark ? 'overlay' : 'multiply'; ctx.fillStyle = ctx.createPattern(grain(), 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore(); }

  // texto con *palabras resaltadas*
  function tokens(text) {
    var out = [], emph = false;
    String(text || '').split('*').forEach(function (part, i) { if (i > 0) emph = !emph; part.split(/\s+/).forEach(function (w) { if (w) out.push({ w: w, e: emph }); }); });
    return out;
  }
  function layout(ctx, toks, maxW, size, weight) {
    font(ctx, weight, size); var sp = ctx.measureText(' ').width, lines = [], cur = [], cw = 0;
    toks.forEach(function (t) { var w = ctx.measureText(t.w).width; var add = cur.length ? sp + w : w; if (cw + add > maxW && cur.length) { lines.push({ t: cur, w: cw }); cur = [t]; cw = w; t.x = 0; } else { t.x = cur.length ? cw + sp : 0; cur.push(t); cw += add; } t.ww = w; });
    if (cur.length) lines.push({ t: cur, w: cw }); return lines;
  }
  function fitText(ctx, text, maxW, maxH, start, min, weight, lh) {
    var toks = tokens(text);
    for (var s = start; s >= min; s -= 2) { var L = layout(ctx, toks, maxW, s, weight); var wide = L.some(function (l) { return l.w > maxW; }); if (!wide && L.length * s * lh <= maxH) return { s: s, L: L, lh: lh, weight: weight }; }
    return { s: min, L: layout(ctx, toks, maxW, min, weight), lh: lh, weight: weight };
  }
  // style: 'marcador' (fondo de color), 'color' (palabra en color), 'subrayado'
  function drawText(ctx, f, x, y, t, opt) {
    opt = opt || {}; var style = opt.style || 'marcador', ink = opt.ink || t.ink, align = opt.align || 'left', maxW = opt.maxW || 0;
    font(ctx, f.weight, f.s); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    var yy = y + f.s * .82;
    f.L.forEach(function (line, li) {
      var ox = align === 'center' ? x + (maxW - line.w) / 2 : x;
      // fondos del resaltado: corridas continuas de palabras resaltadas
      if (style === 'marcador') {
        var run = null;
        line.t.concat([{ e: false }]).forEach(function (tk) {
          if (tk.e && !run) run = { a: tk.x, b: tk.x + tk.ww };
          else if (tk.e) run.b = tk.x + tk.ww;
          else if (run) {
            var px = f.s * .14, top = yy - f.s * .80, h = f.s * 1.0;
            ctx.save(); ctx.translate(ox + run.a - px, top); ctx.rotate(li % 2 ? .008 : -.012);
            ctx.fillStyle = t.acc; rr(ctx, 0, 0, run.b - run.a + px * 2, h, f.s * .16); ctx.fill(); ctx.restore(); run = null;
          }
        });
      }
      line.t.forEach(function (tk) {
        var c = ink;
        if (tk.e) c = style === 'marcador' ? t.accText : (t.dark ? (t.light2 || t.c2) : t.acc);
        ctx.fillStyle = c; ctx.fillText(tk.w, ox + tk.x, yy);
        if (tk.e && style === 'subrayado') { ctx.fillStyle = t.dark ? (t.light2 || t.c2) : t.acc; rr(ctx, ox + tk.x, yy + f.s * .1, tk.ww, Math.max(5, f.s * .07), 4); ctx.fill(); }
      });
      yy += f.s * f.lh;
    });
    return y + f.L.length * f.s * f.lh;
  }
  function plainLines(ctx, text, maxW, size, weight, fam) {
    font(ctx, weight, size, fam); var words = String(text || '').split(/\s+/).filter(Boolean), out = [], cur = '';
    words.forEach(function (w) { var tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > maxW && cur) { out.push(cur); cur = w; } else cur = tt; });
    if (cur) out.push(cur); return out;
  }
  function para(ctx, text, x, y, maxW, size, color, weight, lh, maxLines, fam) {
    var L = plainLines(ctx, text, maxW, size, weight || 500, fam || BODY);
    if (maxLines && L.length > maxLines) { L = L.slice(0, maxLines); L[maxLines - 1] = L[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
    ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
    L.forEach(function (l, i) { ctx.fillText(l, x, y + size * .85 + i * size * (lh || 1.35)); });
    return y + L.length * size * (lh || 1.35);
  }

  // íconos dibujados
  function check(ctx, x, y, s, bg, fg) { ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = fg; ctx.lineWidth = s * .13; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x + s * .29, y + s * .52); ctx.lineTo(x + s * .44, y + s * .66); ctx.lineTo(x + s * .72, y + s * .36); ctx.stroke(); }
  function cross(ctx, x, y, s, bg, fg) { ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = fg; ctx.lineWidth = s * .12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + s * .34, y + s * .34); ctx.lineTo(x + s * .66, y + s * .66); ctx.moveTo(x + s * .66, y + s * .34); ctx.lineTo(x + s * .34, y + s * .66); ctx.stroke(); }
  function star(ctx, cx, cy, r, color) { ctx.fillStyle = color; ctx.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * .45 : r; ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a)); } ctx.closePath(); ctx.fill(); }
  function stars(ctx, x, y, r, n) { for (var i = 0; i < (n || 5); i++) star(ctx, x + r + i * r * 2.35, y + r, r, '#fbbf24'); }
  function chatIcon(ctx, x, y, s, color) { ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24); ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(4, 20); ctx.lineTo(5.3, 16.1); ctx.bezierCurveTo(1.5, 10, 6, 3.5, 12, 3.5); ctx.bezierCurveTo(17.5, 3.5, 21, 7.3, 21, 12); ctx.bezierCurveTo(21, 17, 16.5, 20.6, 11.5, 20.3); ctx.bezierCurveTo(10.2, 20.2, 9, 19.9, 8, 19.4); ctx.closePath(); ctx.stroke(); ctx.restore(); }
  function ticks(ctx, x, y, s, color) { ctx.strokeStyle = color; ctx.lineWidth = s * .12; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; [0, s * .32].forEach(function (o) { ctx.beginPath(); ctx.moveTo(x + o, y + s * .5); ctx.lineTo(x + o + s * .25, y + s * .75); ctx.lineTo(x + o + s * .72, y + s * .2); ctx.stroke(); }); }
  function arrow(ctx, x1, y1, x2, y2, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var mx = (x1 + x2) / 2 + (y2 - y1) * .25, my = (y1 + y2) / 2 - (x2 - x1) * .25;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
    var a = Math.atan2(y2 - my, x2 - mx), L = w * 4.2;
    ctx.beginPath(); ctx.moveTo(x2 - L * Math.cos(a - .5), y2 - L * Math.sin(a - .5)); ctx.lineTo(x2, y2); ctx.lineTo(x2 - L * Math.cos(a + .5), y2 - L * Math.sin(a + .5)); ctx.stroke();
  }

  // ------------------------------------------------------------ piezas comunes
  function brandRow(ctx, b, t, x, y, logo, light) {
    var s = 74, ink = light ? '#ffffff' : t.ink;
    if (logo) { var lw = Math.min(260, logo.width / logo.height * s); ctx.drawImage(logo, x, y, lw, s); return; }
    var g = ctx.createLinearGradient(x, y, x + s, y + s); g.addColorStop(0, t.c1); g.addColorStop(1, mix(t.c1, t.c2, .7)); ctx.fillStyle = g; rr(ctx, x, y, s, s, 20); ctx.fill();
    ctx.fillStyle = onColor(t.c1); font(ctx, 800, 40); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((b.nombre || '?').trim().charAt(0).toUpperCase(), x + s / 2, y + s / 2 + 2);
    ctx.textAlign = 'left'; ctx.fillStyle = ink; font(ctx, 700, 36); ctx.fillText(b.nombre || '', x + s + 20, y + s / 2 + 2); ctx.textBaseline = 'alphabetic';
  }
  function sticker(ctx, text, x, y, t, rot, size) {
    if (!text) return; size = size || 30; font(ctx, 800, size); spaced(ctx, size * .06);
    var tw = ctx.measureText(text.toUpperCase()).width, w = tw + size * 1.5, h = size * 2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot == null ? -.07 : rot); shadow(ctx, 30, 12, t.dark ? .45 : .18);
    ctx.fillStyle = t.sticker; rr(ctx, -w, 0, w, h, h / 2); ctx.fill(); noShadow(ctx);
    ctx.fillStyle = t.stickerText; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(text.toUpperCase(), -w / 2, h / 2 + 1); ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; spaced(ctx, 0);
  }
  function cta(ctx, text, x, y, maxW, t, onPhoto) {
    var h = 104; font(ctx, 700, 36); var tw = ctx.measureText(text).width, w = Math.min(maxW, tw + 64 + h);
    shadow(ctx, 40, 16, t.dark || onPhoto ? .45 : .16);
    var g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, t.dark ? t.c1 : t.acc); g.addColorStop(1, t.dark ? mix(t.c1, t.c2, .45) : mix(t.acc, t.c2, .25));
    ctx.fillStyle = g; rr(ctx, x, y, w, h, h / 2); ctx.fill(); noShadow(ctx);
    var tc = onColor(t.dark ? t.c1 : t.acc); ctx.fillStyle = tc; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 48, y + h / 2 + 2);
    var cx = x + w - h / 2, cy = y + h / 2; ctx.fillStyle = tc === '#ffffff' ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.arc(cx, cy, h / 2 - 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = tc; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx - 13, cy); ctx.lineTo(cx + 12, cy); ctx.moveTo(cx + 2, cy - 11); ctx.lineTo(cx + 13, cy); ctx.lineTo(cx + 2, cy + 11); ctx.stroke();
    ctx.textBaseline = 'alphabetic'; return h;
  }
  function checksRow(ctx, items, x, y, maxW, t, size) {
    size = size || 30; var cx = x, cy = y, s = size * 1.1;
    items.forEach(function (it) {
      font(ctx, 600, size, BODY); var w = s + 14 + ctx.measureText(it).width;
      if (cx + w > x + maxW && cx > x) { cx = x; cy += s + 18; }
      check(ctx, cx, cy, s, t.dark ? rgba(t.light2 || t.c2, .18) : rgba(t.acc, .12), t.dark ? (t.light2 || t.c2) : t.acc);
      ctx.fillStyle = t.ink; ctx.textBaseline = 'middle'; ctx.fillText(it, cx + s + 14, cy + s / 2 + 1); ctx.textBaseline = 'alphabetic';
      cx += w + 34;
    });
    return cy + s;
  }
  function eyebrow(ctx, text, x, y, t) { font(ctx, 700, 26, BODY); spaced(ctx, 5); ctx.fillStyle = t.dark ? (t.light2 || t.c2) : t.acc; ctx.fillText(String(text).toUpperCase(), x, y + 22); spaced(ctx, 0); return y + 26; }
  function lines(s) { return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function avatar(ctx, x, y, s, t, img, name) {
    ctx.save(); ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); ctx.clip();
    if (img) cover(ctx, img, x, y, s, s, .3); else { var g = ctx.createLinearGradient(x, y, x + s, y + s); g.addColorStop(0, mix(t.c2, '#ffffff', .2)); g.addColorStop(1, t.c1); ctx.fillStyle = g; ctx.fillRect(x, y, s, s); ctx.fillStyle = '#fff'; font(ctx, 800, s * .42); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((name || '?').charAt(0).toUpperCase(), x + s / 2, y + s / 2 + 2); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; }
    ctx.restore();
  }

  // ------------------------------------------------------------ plantillas
  function draw(cv, b, o) {
    // o: { tpl, fmt, text, n (variante 1..3), estilo, logo, photo }
    var W = FMT[o.fmt][0], H = FMT[o.fmt][1], ctx = cv.getContext('2d'), t = theme(b, o.estilo), story = H > 1500, tall = H > 1100;
    cv.width = W; cv.height = H; ctx.textAlign = 'left'; noShadow(ctx);
    var P = 80, top = story ? 220 : 76, bottom = story ? H - 330 : H - 76, cw = W - 2 * P, v = o.n || 1;
    var style = ['marcador', 'color', 'subrayado'][(v - 1) % 3], ctaText = b.cta || 'Escribinos por WhatsApp';
    var photoT = o.tpl === 'foto';
    if (!photoT) background(ctx, W, H, t, v);

    var ctaY = bottom - 104, bodyTop = top + 74 + (story ? 90 : 56), bodyBot = ctaY - (story ? 70 : 46), bh = bodyBot - bodyTop;

    if (o.tpl === 'gancho') {
      brandRow(ctx, b, t, P, top, o.logo);
      sticker(ctx, b.sello, W - P + 6, top + 4, t, -.06);
      var ben = lines(b.beneficios).slice(0, 3), benH = ben.length ? (tall ? 140 : 70) : 0;
      var f = fitText(ctx, o.text, cw, bh * .70 - benH, story ? 150 : (tall ? 132 : 118), 60, 800, 1.04);
      var block = f.L.length * f.s * f.lh + 30 + 46 * 1.4 + 40 + benH;
      var y = bodyTop + Math.max(0, (bh - block) * (story ? .42 : .5));
      y = drawText(ctx, f, P, y, t, { style: style });
      y = para(ctx, b.bajada, P, y + 26, cw * .9, 42, t.muted, 500, 1.35, 2);
      if (ben.length) checksRow(ctx, tall ? ben : ben.slice(0, 2), P, y + 40, cw, t, story ? 34 : 31);
      cta(ctx, ctaText, P, ctaY, cw, t);
    }

    else if (o.tpl === 'chat') {
      brandRow(ctx, b, t, P, top, o.logo);
      var fh = fitText(ctx, o.text, cw, story ? 300 : (tall ? 230 : 170), story ? 104 : 84, 52, 800, 1.06);
      var yh = drawText(ctx, fh, P, bodyTop - (story ? 0 : 14), t, { style: style });
      var px = P, py = yh + (story ? 60 : 36), pw = cw, ph = bodyBot - py + (story ? 0 : 10);
      var dk = t.dark, head = dk ? '#1f2c34' : '#f0f2f5', body = dk ? '#0b141a' : '#efeae2';
      ctx.save(); shadow(ctx, 60, 24, dk ? .55 : .18); ctx.fillStyle = body; rr(ctx, px, py, pw, ph, 40); ctx.fill(); noShadow(ctx);
      rr(ctx, px, py, pw, ph, 40); ctx.clip();
      ctx.fillStyle = head; ctx.fillRect(px, py, pw, 108);
      avatar(ctx, px + 28, py + 22, 64, t, o.logo ? null : null, b.nombre);
      ctx.fillStyle = dk ? '#e9edef' : '#111b21'; font(ctx, 600, 32, BODY); ctx.fillText(b.nombre || '', px + 112, py + 52);
      ctx.fillStyle = dk ? '#8696a0' : '#667781'; font(ctx, 400, 25, BODY); ctx.fillText('en línea', px + 112, py + 86);
      var msgs = [['in', b.chatQ], ['out', b.chatA], ['in', b.chatQ2], ['out', b.chatA2]].filter(function (m) { return m[1]; });
      var my = py + 140, maxB = pw * .76, firstOut = null, times = ['21:03', '21:04', '21:04', '21:05'];
      for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i], L = plainLines(ctx, m[1], maxB - 60, 31, 400, BODY), bw0 = 0;
        font(ctx, 400, 31, BODY); L.forEach(function (l) { bw0 = Math.max(bw0, ctx.measureText(l).width); });
        var bw = Math.max(bw0 + 60, 210), bH = L.length * 42 + 56;
        if (my + bH > py + ph - 24) break;
        var bx = m[0] === 'out' ? px + pw - 26 - bw : px + 26;
        ctx.fillStyle = m[0] === 'out' ? (dk ? '#005c4b' : '#d9fdd3') : (dk ? '#202c33' : '#ffffff');
        shadow(ctx, 2, 1, .12); rr(ctx, bx, my, bw, bH, 22); ctx.fill(); noShadow(ctx);
        ctx.fillStyle = dk ? '#e9edef' : '#111b21'; font(ctx, 400, 31, BODY);
        L.forEach(function (l, k) { ctx.fillText(l, bx + 26, my + 44 + k * 42); });
        ctx.fillStyle = dk ? 'rgba(233,237,239,.6)' : '#667781'; font(ctx, 400, 21, BODY); ctx.fillText(times[i], bx + bw - (m[0] === 'out' ? 106 : 72), my + bH - 16);
        if (m[0] === 'out') { ticks(ctx, bx + bw - 50, my + bH - 34, 26, '#53bdeb'); if (!firstOut) firstOut = { x: bx, y: my, h: bH }; }
        my += bH + 18;
      }
      ctx.restore();
      if (b.nota && firstOut) {
        // la nota va en un espacio vacío: debajo de los mensajes (dentro del chat) o debajo del chat; si no hay lugar, no va
        var ns = story ? 66 : 56; font(ctx, 700, ns, HAND); var nt = b.nota, nw = ctx.measureText(nt).width, ny = null;
        if (py + ph - my > ns + 40) ny = my + ns * .9;
        else if (ctaY - (py + ph) > ns + 50) ny = py + ph + ns + 6;
        if (ny != null) {
          var nx = P + 40, ac = t.dark ? (t.light2 || t.c2) : t.acc;
          ctx.save(); ctx.translate(nx, ny); ctx.rotate(-.04); ctx.fillStyle = ac; ctx.fillText(nt, 0, 0); ctx.restore();
          arrow(ctx, nx + nw + 24, ny - ns * .35, Math.min(firstOut.x + 40, px + pw - 60), firstOut.y + firstOut.h - 6, ac, 5);
        }
      }
      cta(ctx, ctaText, P, ctaY, cw, t);
    }

    else if (o.tpl === 'resena') {
      brandRow(ctx, b, t, P, top, o.logo);
      var ey = eyebrow(ctx, 'Lo que dicen nuestros clientes', P, bodyTop - 6, t);
      var cx0 = P, cwid = cw, ip = 56, avS = 96, avail = bodyBot - (ey + 40);
      var fq = fitText(ctx, '«' + (b.testimonio || '') + '»', cwid - ip * 2, avail - (ip * 2 + 80 + avS + 60), story ? 84 : (tall ? 70 : 60), 34, 700, 1.22);
      var qh = fq.L.length * fq.s * fq.lh, chei = Math.min(avail, ip + 80 + qh + 56 + avS + ip), cy0 = ey + 40 + (story ? Math.max(0, (avail - chei) / 2) : 0);
      ctx.fillStyle = t.dark ? 'rgba(255,255,255,.04)' : 'rgba(11,15,23,.04)'; rr(ctx, cx0 + 36, cy0 + 26, cwid - 72, chei, 40); ctx.fill();
      shadow(ctx, 60, 24, t.dark ? .5 : .12); ctx.fillStyle = t.card; rr(ctx, cx0, cy0, cwid, chei, 40); ctx.fill(); noShadow(ctx);
      ctx.strokeStyle = t.line; ctx.lineWidth = 2; rr(ctx, cx0, cy0, cwid, chei, 40); ctx.stroke();
      stars(ctx, cx0 + ip, cy0 + ip, 21);
      ctx.fillStyle = t.dark ? (t.light2 || t.c2) : t.acc; font(ctx, 800, 150); ctx.fillText('”', cx0 + cwid - ip - 70, cy0 + ip + 110);
      drawText(ctx, fq, cx0 + ip, cy0 + ip + 80, t, { style: 'color' });
      var ay = cy0 + chei - ip - avS;
      avatar(ctx, cx0 + ip, ay, avS, t, o.photo, b.autor);
      ctx.fillStyle = t.ink; font(ctx, 700, 34, BODY); ctx.fillText((b.autor || '').split(',')[0], cx0 + ip + avS + 24, ay + 42);
      check(ctx, cx0 + ip + avS + 24, ay + 56, 28, t.dark ? rgba(t.light2 || t.c2, .2) : rgba(t.acc, .12), t.dark ? (t.light2 || t.c2) : t.acc);
      ctx.fillStyle = t.muted; font(ctx, 500, 26, BODY); ctx.fillText('Cliente verificado', cx0 + ip + avS + 62, ay + 80);
      cta(ctx, ctaText, P, ctaY, cw, t);
    }

    else if (o.tpl === 'vs') {
      brandRow(ctx, b, t, P, top, o.logo);
      var fv = fitText(ctx, o.text, cw, story ? 300 : (tall ? 220 : 150), story ? 100 : 80, 48, 800, 1.06);
      var yv = drawText(ctx, fv, P, bodyTop - (story ? 0 : 14), t, { style: style }) + (story ? 60 : 34);
      var us = lines(b.beneficios).slice(0, 4), them = lines(b.otros).slice(0, 4), rows = Math.max(us.length, them.length, 1);
      var gap = 22, colW = (cw - gap) / 2, th = bodyBot - yv, rowH = Math.min(story ? 150 : 112, (th - 110) / rows);
      // columna "otros"
      ctx.fillStyle = t.soft; rr(ctx, P, yv + 18, colW, th - 18, 32); ctx.fill();
      ctx.fillStyle = t.muted; font(ctx, 700, 28, BODY); spaced(ctx, 3); ctx.fillText('OTROS', P + 34, yv + 76); spaced(ctx, 0);
      them.forEach(function (it, k) { var ry = yv + 110 + k * rowH; cross(ctx, P + 30, ry + (rowH - 40) / 2 - 6, 40, t.dark ? 'rgba(255,107,107,.16)' : 'rgba(220,38,38,.10)', t.dark ? '#ff8a8a' : '#dc2626'); para(ctx, it, P + 86, ry + (rowH - 40) / 2 - 18, colW - 110, story ? 33 : 29, t.muted, 500, 1.2, 2); });
      // columna de la marca
      var bx2 = P + colW + gap; shadow(ctx, 50, 18, t.dark ? .5 : .14);
      var bg = ctx.createLinearGradient(bx2, yv, bx2, yv + th); bg.addColorStop(0, t.dark ? mix(t.card, t.c1, .22) : '#ffffff'); bg.addColorStop(1, t.card);
      ctx.fillStyle = bg; rr(ctx, bx2, yv, colW, th, 32); ctx.fill(); noShadow(ctx);
      ctx.strokeStyle = t.dark ? rgba(t.light2 || t.c2, .55) : t.acc; ctx.lineWidth = 3; rr(ctx, bx2, yv, colW, th, 32); ctx.stroke();
      ctx.fillStyle = t.ink; font(ctx, 800, 34); ctx.fillText(b.nombre || 'Nosotros', bx2 + 34, yv + 62);
      us.forEach(function (it, k) { var ry = yv + 92 + k * rowH; check(ctx, bx2 + 30, ry + (rowH - 40) / 2 - 6, 40, t.dark ? rgba(t.light2 || t.c2, .2) : rgba(t.acc, .12), t.dark ? (t.light2 || t.c2) : t.acc); para(ctx, it, bx2 + 86, ry + (rowH - 40) / 2 - 18, colW - 110, story ? 33 : 29, t.ink, 600, 1.2, 2); });
      cta(ctx, ctaText, P, ctaY, cw, t);
    }

    else if (o.tpl === 'pasos') {
      brandRow(ctx, b, t, P, top, o.logo);
      var ey2 = eyebrow(ctx, 'Cómo funciona', P, bodyTop - 6, t);
      var fp = fitText(ctx, o.text, cw, story ? 300 : (tall ? 220 : 150), story ? 100 : 80, 48, 800, 1.06);
      var yp = drawText(ctx, fp, P, ey2 + 24, t, { style: style }) + (story ? 70 : 40);
      var st = lines(b.pasos).slice(0, 3), sh = Math.min(story ? 230 : 999, (bodyBot - yp) / Math.max(1, st.length)), cs = Math.min(story ? 104 : 84, sh * .62);
      if (story) yp += Math.max(0, (bodyBot - yp - sh * st.length) / 2);
      ctx.strokeStyle = t.dark ? rgba(t.light2 || t.c2, .4) : rgba(t.acc, .35); ctx.lineWidth = 4; ctx.setLineDash([2, 14]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(P + cs / 2, yp + cs / 2 + 8); ctx.lineTo(P + cs / 2, yp + (st.length - 1) * sh + cs / 2 - 8); ctx.stroke(); ctx.setLineDash([]);
      st.forEach(function (s, k) {
        var sy = yp + k * sh; shadow(ctx, 24, 8, t.dark ? .4 : .14);
        ctx.fillStyle = k === st.length - 1 ? (t.dark ? t.c1 : t.acc) : t.card; ctx.beginPath(); ctx.arc(P + cs / 2, sy + cs / 2, cs / 2, 0, Math.PI * 2); ctx.fill(); noShadow(ctx);
        if (k !== st.length - 1) { ctx.strokeStyle = t.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P + cs / 2, sy + cs / 2, cs / 2, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = k === st.length - 1 ? onColor(t.dark ? t.c1 : t.acc) : t.ink; font(ctx, 800, cs * .44); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(k + 1), P + cs / 2, sy + cs / 2 + 2); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        var fs = Math.min(story ? 56 : 46, cs * .58); var Ls = plainLines(ctx, s, cw - cs - 40, fs, 700, DISPLAY).slice(0, 2);
        ctx.fillStyle = t.ink; font(ctx, 700, fs); Ls.forEach(function (l, q) { ctx.fillText(l, P + cs + 34, sy + cs / 2 + fs * .36 - (Ls.length - 1) * fs * .6 + q * fs * 1.2); });
      });
      cta(ctx, ctaText, P, ctaY, cw, t);
    }

    else if (o.tpl === 'dato') {
      brandRow(ctx, b, t, P, top, o.logo);
      sticker(ctx, b.sello, W - P + 6, top + 4, t, .05);
      var num = b.dato || '24/7', ds = story ? 380 : (tall ? 330 : 290); font(ctx, 900, ds); while (ctx.measureText(num).width > cw && ds > 120) { ds -= 10; font(ctx, 900, ds); }
      var lbl = fitText(ctx, b.datoTxt || '', cw, 180, story ? 72 : 62, 36, 800, 1.08);
      var sub = o.text ? plainLines(ctx, o.text.replace(/\*/g, ''), cw, 40, 500, BODY).length * 54 : 0;
      var blockH = ds * .86 + 30 + lbl.L.length * lbl.s * lbl.lh + 26 + sub;
      var yd = bodyTop + Math.max(0, (bh - blockH) / 2);
      var ng = ctx.createLinearGradient(P, yd, P + ctx.measureText(num).width, yd + ds); ng.addColorStop(0, t.dark ? (t.light2 || t.c2) : t.acc); ng.addColorStop(1, t.dark ? '#ffffff' : mix(t.acc, t.c2, .5));
      ctx.fillStyle = ng; font(ctx, 900, ds); ctx.fillText(num, P - ds * .04, yd + ds * .78);
      var yl = drawText(ctx, lbl, P, yd + ds * .86 + 30, t, { style: 'color' });
      para(ctx, o.text.replace(/\*/g, ''), P, yl + 22, cw, 40, t.muted, 500, 1.35, 3);
      cta(ctx, ctaText, P, ctaY, cw, t);
    }

    else if (o.tpl === 'foto') {
      if (t.dark || !o.photo) {
        ctx.fillStyle = '#07090e'; ctx.fillRect(0, 0, W, H);
        if (o.photo) cover(ctx, o.photo, 0, 0, W, H, .35); else background(ctx, W, H, t, v);
        var ov = ctx.createLinearGradient(0, 0, 0, H); ov.addColorStop(0, 'rgba(5,7,11,.70)'); ov.addColorStop(.16, 'rgba(5,7,11,.12)'); ov.addColorStop(.42, 'rgba(5,7,11,.18)'); ov.addColorStop(.62, 'rgba(5,7,11,.86)'); ov.addColorStop(1, 'rgba(5,7,11,.97)');
        ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H);
        var td = Object.assign({}, t, { dark: true, ink: '#ffffff', muted: 'rgba(255,255,255,.74)', light2: toward(t.c2, .62) });
        brandRow(ctx, b, td, P, top, o.logo, true);
        sticker(ctx, b.sello, W - P + 6, top + 4, Object.assign({}, td, { sticker: td.light2, stickerText: onColor(td.light2) }), -.06);
        var ff = fitText(ctx, o.text, cw, story ? 420 : (tall ? 330 : 250), story ? 128 : 108, 56, 800, 1.04);
        var bajH = b.bajada ? 2 * 42 * 1.35 + 20 : 0, yf = ctaY - (story ? 70 : 46) - bajH - ff.L.length * ff.s * ff.lh;
        shadow(ctx, 30, 0, .35); var ye = drawText(ctx, ff, P, yf, Object.assign({}, td, { acc: t.c1, accText: onColor(t.c1) }), { style: style }); noShadow(ctx);
        if (b.bajada) para(ctx, b.bajada, P, ye + 18, cw * .9, 40, 'rgba(255,255,255,.80)', 500, 1.35, 2);
        cta(ctx, ctaText, P, ctaY, cw, td, true);
      } else {
        ctx.fillStyle = t.bg; ctx.fillRect(0, 0, W, H);
        var ph2 = Math.round(H * (story ? .52 : .54)); cover(ctx, o.photo, 0, 0, W, ph2, .35);
        var tg = ctx.createLinearGradient(0, 0, 0, 260); tg.addColorStop(0, 'rgba(0,0,0,.45)'); tg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 260);
        brandRow(ctx, b, Object.assign({}, t, { ink: '#ffffff' }), P, top, o.logo, true);
        var panelY = ph2 - 60; shadow(ctx, 50, -10, .12); ctx.fillStyle = t.bg; rr(ctx, 0, panelY, W, H - panelY + 60, 56); ctx.fill(); noShadow(ctx);
        sticker(ctx, b.sello, W - P + 6, panelY - 40, t, .05);
        var fl = fitText(ctx, o.text, cw, ctaY - panelY - (story ? 200 : 130), story ? 110 : 96, 50, 800, 1.04);
        var yl2 = drawText(ctx, fl, P, panelY + (story ? 90 : 64), t, { style: style });
        if (b.bajada && ctaY - yl2 > 150) para(ctx, b.bajada, P, yl2 + 16, cw * .9, 38, t.muted, 500, 1.35, 2);
        cta(ctx, ctaText, P, ctaY, cw, t);
      }
    }

    else if (o.tpl === 'notif') {
      if (o.photo) { ctx.save(); ctx.filter = 'blur(28px) saturate(1.2)'; cover(ctx, o.photo, -60, -60, W + 120, H + 120); ctx.restore(); ctx.fillStyle = t.dark ? 'rgba(7,9,14,.58)' : rgba(t.bg, .84); ctx.fillRect(0, 0, W, H); }
      brandRow(ctx, b, t, P, top, o.logo);
      var fn = fitText(ctx, o.text, cw, story ? 320 : (tall ? 240 : 170), story ? 108 : 86, 50, 800, 1.06);
      var yn = drawText(ctx, fn, P, bodyTop - (story ? 0 : 14), t, { style: style }) + (story ? 70 : 40);
      var nots = lines(b.notifs).slice(0, story ? 4 : (tall ? 3 : 2)), nh = story ? 172 : 156, ngap = 20;
      var stackH = nots.length * (nh + ngap) - ngap, ny0 = yn + Math.max(0, (bodyBot - yn - stackH) / 2);
      nots.forEach(function (txt, k) {
        var nyk = ny0 + k * (nh + ngap), inset = k === 0 ? 0 : 0;
        ctx.save(); ctx.globalAlpha = 1 - k * .12; shadow(ctx, 40, 14, t.dark ? .45 : .16);
        ctx.fillStyle = t.dark ? 'rgba(38,40,48,.92)' : 'rgba(255,255,255,.94)'; rr(ctx, P + inset, nyk, cw - inset * 2, nh, 34); ctx.fill(); noShadow(ctx);
        ctx.fillStyle = '#25d366'; rr(ctx, P + 26, nyk + 28, 58, 58, 15); ctx.fill(); chatIcon(ctx, P + 37, nyk + 39, 36, '#ffffff');
        ctx.fillStyle = t.dark ? 'rgba(255,255,255,.55)' : 'rgba(11,15,23,.5)'; font(ctx, 600, 22, BODY); spaced(ctx, 1.5); ctx.fillText('WHATSAPP', P + 104, nyk + 46); spaced(ctx, 0);
        font(ctx, 500, 22, BODY); ctx.textAlign = 'right'; ctx.fillText(k === 0 ? 'ahora' : 'hace ' + (k * 2) + ' min', P + cw - 30, nyk + 46); ctx.textAlign = 'left';
        ctx.fillStyle = t.ink; font(ctx, 700, 31, BODY); ctx.fillText(b.nombre || '', P + 104, nyk + 86);
        ctx.fillStyle = t.dark ? 'rgba(255,255,255,.82)' : 'rgba(11,15,23,.78)'; var tl = plainLines(ctx, txt, cw - 140, 31, 400, BODY)[0] || ''; if (plainLines(ctx, txt, cw - 140, 31, 400, BODY).length > 1) tl = tl.replace(/\s*\S*$/, '') + '…';
        font(ctx, 400, 31, BODY); ctx.fillText(tl, P + 104, nyk + (story ? 132 : 126)); ctx.restore();
      });
      cta(ctx, ctaText, P, ctaY, cw, t);
    }

    addGrain(ctx, W, H, t);
    return cv;
  }

  window.PIEZAS = { draw: draw, FMT: FMT, TPL: TPL, theme: theme, fontsReady: function () {
    var L = ['900 80px "Inter Tight"', '800 80px "Inter Tight"', '700 40px "Inter Tight"', '400 30px Inter', '500 30px Inter', '600 30px Inter', '700 30px Inter', '700 50px Caveat'];
    return Promise.all(L.map(function (f) { try { return document.fonts.load(f); } catch (e) { return null; } })).catch(function () {});
  } };
})();
