// "La Mesa Chica" v3 · estética cinematográfica con interfaces reales · 1080x1920 · 30 fps · 32 s
(function () {
  'use strict';
  var W = 1080, H = 1920, DUR = 32;
  var C = { ink: '#f2f4f8', mut: 'rgba(242,244,248,.58)', dim: 'rgba(242,244,248,.32)', gold: '#e8b85a', gold2: '#ffe2a0', red: '#ff4d4d', green: '#34e3a0', glass: 'rgba(255,255,255,.045)', edge: 'rgba(255,255,255,.10)' };
  var D = '"Inter Tight", Inter, sans-serif', B = 'Inter, sans-serif';

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function p(t, a, d) { return clamp((t - a) / d, 0, 1); }
  function eo(x) { return 1 - Math.pow(1 - x, 3); }
  function eo5(x) { return 1 - Math.pow(1 - x, 5); }
  function eio(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function lerp(a, b, x) { return a + (b - a) * x; }
  function win(t, a, b, fi, fo) { return Math.min(eo(p(t, a, fi || .35)), 1 - eio(p(t, b - (fo || .35), fo || .35))); }
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function font(ctx, w, s, f, sp) { ctx.font = w + ' ' + s + 'px ' + (f || D); try { ctx.letterSpacing = (sp != null ? sp : (f === B ? 0 : -s * .035)) + 'px'; } catch (e) {} }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function txt(ctx, s, x, y, o) { o = o || {}; font(ctx, o.w || 700, o.s || 40, o.f, o.sp); ctx.textAlign = o.a || 'left'; ctx.textBaseline = 'alphabetic'; var b = ctx.globalAlpha; ctx.globalAlpha = b * (o.al == null ? 1 : o.al); ctx.fillStyle = o.c || C.ink; ctx.fillText(s, x, y); ctx.globalAlpha = b; return ctx.measureText(s).width; }
  function goldG(ctx, x0, x1) { var g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#c98a2e'); g.addColorStop(.5, C.gold2); g.addColorStop(1, C.gold); return g; }
  function glass(ctx, x, y, w, h, r, tint) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
    var g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, 'rgba(30,36,48,.92)'); g.addColorStop(1, 'rgba(14,17,24,.94)'); ctx.fillStyle = g; rr(ctx, x, y, w, h, r); ctx.fill(); ctx.restore();
    var e = ctx.createLinearGradient(x, y, x + w, y + h); e.addColorStop(0, tint || 'rgba(255,255,255,.16)'); e.addColorStop(.5, 'rgba(255,255,255,.04)'); e.addColorStop(1, 'rgba(255,255,255,.08)');
    ctx.strokeStyle = e; ctx.lineWidth = 1.5; rr(ctx, x + .5, y + .5, w - 1, h - 1, r); ctx.stroke();
  }
  var grainC = null;
  function grain() { if (grainC) return grainC; grainC = document.createElement('canvas'); grainC.width = grainC.height = 256; var g = grainC.getContext('2d'), d = g.createImageData(256, 256), s = 9; for (var i = 0; i < d.data.length; i += 4) { s = (s * 16807) % 2147483647; var v = s % 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); return grainC; }

  // ------------------------------------------------------------ luz y atmósfera
  function warm(t) { return eio(p(t, 11.2, 3)); }
  function bg(ctx, t) {
    var w = warm(t);
    ctx.fillStyle = '#040508'; ctx.fillRect(0, 0, W, H);
    // haz de luz principal: frío y apagado en el problema, cálido en la solución
    var cx = W * .5 + Math.sin(t * .3) * 60, cy = H * .38;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1100);
    g.addColorStop(0, w < .5 ? 'rgba(60,80,110,' + (.38 * (1 - w)) + ')' : 'rgba(200,140,60,' + (.34 * w) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (w > .05) { var g2 = ctx.createRadialGradient(W * .85, H * .82, 0, W * .85, H * .82, 900); g2.addColorStop(0, 'rgba(52,227,160,' + (.12 * w) + ')'); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H); }
    // polvo en suspensión dentro del haz
    for (var i = 0; i < 40; i++) { var ph = (t * .03 + rnd(i)) % 1, x = rnd(i + 7) * W + Math.sin(t * .4 + i) * 20, y = H * (1 - ph); ctx.fillStyle = 'rgba(255,255,255,' + (.06 + .08 * rnd(i + 3)) * (1 - Math.abs(ph - .5) * 1.6) + ')'; ctx.beginPath(); ctx.arc(x, y, 1.2 + rnd(i + 5) * 1.8, 0, Math.PI * 2); ctx.fill(); }
  }
  function post(ctx, t) {
    var v = ctx.createRadialGradient(W / 2, H * .45, W * .25, W / 2, H * .45, H * .8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.9)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // barras de cine finas arriba y abajo durante el problema
    var bars = 1 - warm(t); if (bars > 0) { ctx.fillStyle = 'rgba(0,0,0,' + .9 * bars + ')'; ctx.fillRect(0, 0, W, 70 * bars); ctx.fillRect(0, H - 70 * bars, W, 70 * bars); }
    ctx.save(); ctx.globalAlpha = .07; ctx.globalCompositeOperation = 'overlay'; ctx.translate((t * 997) % 256, (t * 613) % 256); ctx.fillStyle = ctx.createPattern(grain(), 'repeat'); ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore();
  }
  // desaturar y enfriar todo lo dibujado durante el problema
  function grade(ctx, t) {
    var k = 1 - warm(t); if (k <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,' + .4 * k + ')'; ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(40,70,120,' + .35 * k + ')'; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  // ------------------------------------------------------------ títulos
  function hook(ctx, t) {
    if (t > 11.4) return;
    var up = eio(p(t, 2.7, .7)), out = 1 - eio(p(t, 10.6, .6));
    var y = lerp(900, 330, up), s = lerp(124, 70, up);
    ctx.save(); ctx.globalAlpha = out;
    var k1 = eo5(p(t, .3, .9)), k2 = eo5(p(t, .7, .9));
    ctx.save(); ctx.beginPath(); ctx.rect(0, y - s * 1.9, W, s * 1.05); ctx.clip();
    txt(ctx, '¿Estás cansado', W / 2, y - s * .95 + (1 - k1) * s, { w: 900, s: s, a: 'center' }); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0, y - s * .88, W, s * 1.1); ctx.clip();
    txt(ctx, 'de lo mismo?', W / 2, y + s * .1 + (1 - k2) * s, { w: 900, s: s, a: 'center', c: C.red }); ctx.restore();
    var lw = eo(p(t, 1.4, .7)); ctx.fillStyle = C.red; ctx.fillRect(W / 2 - 160 * lw * s / 150, y + s * .32, 320 * lw * s / 150, Math.max(3, 6 * s / 150));
    ctx.restore();
  }
  var PAINS = [['01', 'WhatsApp que se caen'], ['02', 'Pauta sin estructura'], ['03', 'No poder escalar'], ['04', 'Facturación estancada'], ['05', 'Creativos que no convierten']];
  var T0 = 3.3, SEG = 1.55;
  function painIndex(t) { return clamp(Math.floor((t - T0) / SEG), 0, 4); }
  function painCaption(ctx, t) {
    if (t < T0 || t > 11.1) return;
    var i = painIndex(t), lt = t - T0 - i * SEG, k = eo(p(lt, 0, .3)) * (i === 4 ? 1 - eio(p(t, 10.5, .5)) : 1 - eio(p(lt, SEG - .25, .25)));
    ctx.save(); ctx.globalAlpha = k;
    txt(ctx, PAINS[i][0] + ' / 05', 90, 520, { w: 700, s: 26, f: B, c: C.red, sp: 4 });
    txt(ctx, PAINS[i][1], 90, 590 + (1 - k) * 14, { w: 800, s: 62 });
    ctx.restore();
  }

  // ------------------------------------------------------------ las 5 escenas del problema (interfaces)
  function stage(ctx, t, i, fn) {
    var a = T0 + i * SEG, lt = t - a, inK = eo5(p(lt, 0, .45)), outK = i === 4 ? 1 - eio(p(t, 10.5, .6)) : 1 - eio(p(lt, SEG - .2, .25));
    var vis = Math.min(inK, outK); if (vis <= 0) return;
    ctx.save(); ctx.globalAlpha = vis; var push = 1 + .05 * p(lt, 0, SEG); ctx.translate(W / 2, 1060); ctx.scale(push * lerp(.92, 1, inK), push * lerp(.92, 1, inK)); ctx.translate(-W / 2, -1060 + (1 - inK) * 40);
    fn(lt); ctx.restore();
  }
  function painPhone(ctx, t, lt) {
    var x = 290, y = 680, w = 500, h = 820;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-.05); ctx.translate(-(x + w / 2), -(y + h / 2));
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 30; ctx.fillStyle = '#0d1016'; rr(ctx, x, y, w, h, 70); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 3; rr(ctx, x + 2, y + 2, w - 4, h - 4, 68); ctx.stroke();
    ctx.fillStyle = '#000'; rr(ctx, x + w / 2 - 70, y + 22, 140, 34, 17); ctx.fill();
    txt(ctx, '23:47', x + 54, y + 50, { w: 700, s: 24, f: B });
    txt(ctx, 'Chats', x + 40, y + 130, { w: 800, s: 42 });
    var names = ['Línea 1 · Ventas', 'Línea 2 · Atención', 'Línea 3 · Soporte', 'Línea 4 · Pagos', 'Línea 5 · Nuevos'];
    names.forEach(function (n, j) {
      var ry = y + 170 + j * 112, down = lt > .25 + j * .22;
      ctx.fillStyle = 'rgba(255,255,255,.04)'; rr(ctx, x + 24, ry, w - 48, 96, 20); ctx.fill();
      ctx.fillStyle = down ? 'rgba(255,77,77,.25)' : 'rgba(52,227,160,.22)'; ctx.beginPath(); ctx.arc(x + 76, ry + 48, 30, 0, Math.PI * 2); ctx.fill();
      txt(ctx, String(j + 1), x + 76, ry + 58, { w: 800, s: 28, a: 'center', c: down ? C.red : C.green });
      txt(ctx, n, x + 124, ry + 42, { w: 700, s: 26, f: B });
      txt(ctx, down ? 'Sin conexión' : 'En línea', x + 124, ry + 76, { w: 600, s: 22, f: B, c: down ? C.red : C.green });
      if (down) { ctx.fillStyle = C.red; rr(ctx, x + w - 92, ry + 32, 44, 32, 16); ctx.fill(); txt(ctx, '!', x + w - 70, ry + 56, { w: 900, s: 24, a: 'center', c: '#fff' }); }
    });
    var tk = eo(p(lt, .9, .3)); if (tk > 0) { ctx.save(); ctx.globalAlpha *= tk; glass(ctx, x - 40, y + 760 - tk * 30, w + 80, 104, 26, 'rgba(255,77,77,.6)'); txt(ctx, '4 de 5 líneas sin conexión', x + w / 2, y + 822 - tk * 30, { w: 700, s: 30, f: B, a: 'center', c: C.red }); ctx.restore(); }
    ctx.restore();
  }
  function painAds(ctx, t, lt) {
    var x = 90, y = 700, w = 900, h = 720; glass(ctx, x, y, w, h, 30);
    txt(ctx, 'Administrador de anuncios', x + 40, y + 66, { w: 700, s: 30, f: B, c: C.mut });
    ['Campaña', 'Estado', 'Resultados'].forEach(function (c, j) { txt(ctx, c.toUpperCase(), x + 40 + [0, 420, 640][j], y + 130, { w: 700, s: 20, f: B, c: C.dim, sp: 2 }); });
    var rows = [['Prueba nueva (copia 3)', 'Pausada', '—'], ['NO TOCAR', 'Activa', '2'], ['Campaña vieja 2', 'Sin datos', '—'], ['Test final final', 'Activa', '0'], ['Copia de copia', 'Error', '—'], ['Escala?? (2)', 'Pausada', '1']];
    rows.forEach(function (r, j) {
      var ry = y + 170 + j * 86, jit = Math.sin(lt * 18 + j * 2) * (lt > .4 ? 2 : 0);
      ctx.fillStyle = j % 2 ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,.045)'; ctx.fillRect(x + 24, ry, w - 48, 74);
      txt(ctx, r[0], x + 40 + jit, ry + 46, { w: 600, s: 28, f: B });
      var bad = r[1] === 'Error' || r[1] === 'Sin datos'; ctx.fillStyle = bad ? 'rgba(255,77,77,.18)' : 'rgba(255,255,255,.07)'; rr(ctx, x + 420, ry + 18, 150, 40, 20); ctx.fill();
      txt(ctx, r[1], x + 495, ry + 45, { w: 700, s: 22, f: B, a: 'center', c: bad ? C.red : C.mut });
      txt(ctx, r[2], x + 690, ry + 46, { w: 700, s: 28, f: B, c: C.mut });
    });
  }
  function painScale(ctx, t, lt) {
    var x = 90, y = 700, w = 900, h = 720; glass(ctx, x, y, w, h, 30);
    txt(ctx, 'Presupuesto vs. ventas', x + 40, y + 66, { w: 700, s: 30, f: B, c: C.mut });
    var cx0 = x + 60, cy0 = y + 620, cw = w - 120, ch = 460;
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; for (var g = 0; g < 5; g++) { ctx.beginPath(); ctx.moveTo(cx0, cy0 - g * ch / 4); ctx.lineTo(cx0 + cw, cy0 - g * ch / 4); ctx.stroke(); }
    var pr = eo(p(lt, .1, 1.1));
    function line(fn, col, wid) { ctx.strokeStyle = col; ctx.lineWidth = wid; ctx.lineJoin = 'round'; ctx.beginPath(); for (var k = 0; k <= 40 * pr; k++) { var f = k / 40, yy = fn(f); k ? ctx.lineTo(cx0 + f * cw, cy0 - yy * ch) : ctx.moveTo(cx0 + f * cw, cy0 - yy * ch); } ctx.stroke(); }
    line(function (f) { return .1 + f * .85; }, 'rgba(242,244,248,.55)', 4);
    line(function (f) { return .22 + Math.min(f, .35) * .55 + Math.sin(f * 30) * .015; }, C.red, 6);
    txt(ctx, 'Presupuesto ↑', x + w - 60, y + 190, { w: 700, s: 26, f: B, a: 'right', c: C.mut, al: pr });
    txt(ctx, 'Ventas →', x + w - 60, y + 450, { w: 800, s: 28, f: B, a: 'right', c: C.red, al: pr });
  }
  function painStuck(ctx, t, lt) {
    var months = ['Septiembre', 'Octubre', 'Noviembre'];
    months.forEach(function (m, j) {
      var k = eo5(p(lt, j * .25, .4)); if (k <= 0) return;
      var y = 700 + j * 245; ctx.save(); ctx.globalAlpha *= k; ctx.translate((1 - k) * 60, 0);
      glass(ctx, 90, y, 900, 210, 28);
      txt(ctx, m.toUpperCase(), 140, y + 62, { w: 700, s: 22, f: B, c: C.dim, sp: 4 });
      var n = j < 2 ? '4.180.000' : (lt > 1 ? '4.180.000' : String(Math.round(4000000 + rnd(Math.floor(lt * 20)) * 400000)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
      txt(ctx, '$ ' + n, 140, y + 160, { w: 900, s: 88, c: j === 2 ? C.red : C.ink });
      txt(ctx, '= mismo número', 950, y + 160, { w: 700, s: 26, f: B, a: 'right', c: C.mut, al: j ? 1 : 0 });
      ctx.restore();
    });
  }
  function painCreatives(ctx, t, lt) {
    var ctr = ['0,4%', '0,6%', '0,3%', '0,5%'];
    for (var j = 0; j < 4; j++) {
      var k = eo5(p(lt, j * .12, .4)); if (k <= 0) continue;
      var x = 90 + (j % 2) * 460, y = 700 + Math.floor(j / 2) * 380; ctx.save(); ctx.globalAlpha *= k; ctx.translate(0, (1 - k) * 40);
      glass(ctx, x, y, 440, 350, 26);
      var g = ctx.createLinearGradient(x, y, x + 440, y + 250); g.addColorStop(0, ['#2b3444', '#3a2f2f', '#2f3a35', '#33303d'][j]); g.addColorStop(1, '#12151c'); ctx.fillStyle = g; rr(ctx, x + 18, y + 18, 404, 220, 18); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.08)'; rr(ctx, x + 46, y + 120, 220, 22, 11); ctx.fill(); rr(ctx, x + 46, y + 156, 160, 22, 11); ctx.fill();
      txt(ctx, 'CTR', x + 36, y + 300, { w: 700, s: 22, f: B, c: C.dim, sp: 3 });
      txt(ctx, ctr[j] + ' ↓', x + 404, y + 306, { w: 900, s: 48, a: 'right', c: C.red });
      ctx.restore();
    }
  }

  // ------------------------------------------------------------ giro: +30 dueños
  function turn(ctx, t) {
    if (t < 10.9 || t > 15.4) return;
    var a = win(t, 11, 15.2, .45, .45); ctx.save(); ctx.globalAlpha = a;
    // línea de luz que barre la pantalla
    var sw = eo5(p(t, 11, .9)); if (sw < 1) { var lx = sw * W; var lg = ctx.createLinearGradient(lx - 200, 0, lx + 40, 0); lg.addColorStop(0, 'rgba(255,220,150,0)'); lg.addColorStop(1, 'rgba(255,220,150,.35)'); ctx.fillStyle = lg; ctx.fillRect(lx - 200, 0, 240, H); }
    txt(ctx, 'POR ESO', W / 2, 420, { w: 700, s: 28, f: B, a: 'center', c: C.gold, sp: 10, al: eo(p(t, 11.2, .4)) });
    var n = Math.max(1, Math.round(30 * eo(p(t, 11.35, 1.5))));
    font(ctx, 900, 300); var s = '+' + n, tw = ctx.measureText(s).width; ctx.fillStyle = goldG(ctx, W / 2 - tw / 2, W / 2 + tw / 2); ctx.textAlign = 'center'; ctx.globalAlpha = a * eo(p(t, 11.35, .35)); ctx.fillText(s, W / 2, 700); ctx.globalAlpha = a;
    txt(ctx, 'dueños de paneles ya están adentro', W / 2, 790, { w: 600, s: 40, f: B, a: 'center', c: C.mut, al: eo(p(t, 12.6, .5)) });
    var L = 'ABCDEFGHJKLMNPRSTVM'.split('');
    for (var i = 0; i < 30; i++) {
      var col = i % 6, row = Math.floor(i / 6), k = eo5(p(t, 11.55 + i * .045, .45)); if (k <= 0) continue;
      var x = 105 + col * 148, y = 880 + row * 128;
      ctx.save(); ctx.globalAlpha = a * k; ctx.translate(0, (1 - k) * 24);
      glass(ctx, x, y, 128, 108, 20, i % 7 === 0 ? 'rgba(232,184,90,.6)' : null);
      var g = ctx.createLinearGradient(x + 34, y + 20, x + 94, y + 80); g.addColorStop(0, 'rgba(232,184,90,.55)'); g.addColorStop(1, 'rgba(232,184,90,.12)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 64, y + 50, 28, 0, Math.PI * 2); ctx.fill();
      txt(ctx, L[i % L.length] + '.', x + 64, y + 60, { w: 800, s: 26, a: 'center', c: '#1a1205' });
      ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(x + 108, y + 18, 6, 0, Math.PI * 2); ctx.fill();
      txt(ctx, 'Activo', x + 64, y + 98, { w: 600, s: 16, f: B, a: 'center', c: C.dim });
      ctx.restore();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ marca
  function mark(ctx, x, y, r, t0, t) {
    var k = eo(p(t, t0, .8)); ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = goldG(ctx, -r, r); ctx.lineWidth = r * .06; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r * .55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
    for (var i = 0; i < 8; i++) { var kk = eo5(p(t, t0 + .4 + i * .06, .4)); if (kk <= 0) continue; var an = -Math.PI / 2 + i * Math.PI / 4; ctx.fillStyle = i ? 'rgba(232,184,90,.7)' : C.gold2; ctx.beginPath(); ctx.arc(Math.cos(an) * r * .86, Math.sin(an) * r * .86, r * .07 * kk, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function logo(ctx, t) {
    if (t < 15 || t > 18.8) return;
    var a = win(t, 15.05, 18.6, .3, .45); ctx.save(); ctx.globalAlpha = a;
    mark(ctx, W / 2, 700, 170, 15.1, t);
    ['LA MESA', 'CHICA'].forEach(function (s, i) {
      var k = eo5(p(t, 15.6 + i * .18, .7)); if (k <= 0) return;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 930 + i * 175, W, 175); ctx.clip(); font(ctx, 900, 176, D, 14);
      var tw = ctx.measureText(s).width; ctx.fillStyle = i ? goldG(ctx, W / 2 - tw / 2, W / 2 + tw / 2) : C.ink; ctx.textAlign = 'center'; ctx.fillText(s, W / 2, 1085 + i * 175 + (1 - k) * 180); ctx.restore();
    });
    var k4 = eo(p(t, 16.5, .6)); txt(ctx, 'ESCUELA DIGITAL PARA DUEÑOS DE PANELES', W / 2, 1360 + (1 - k4) * 16, { w: 600, s: 26, f: B, a: 'center', c: C.mut, sp: 6, al: k4 });
    ctx.restore();
  }

  // ------------------------------------------------------------ centro de comando: pantallas en perspectiva + sesión en vivo
  function miniChart(ctx, x, y, w, h, prog, seed) {
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; for (var g = 1; g < 4; g++) { ctx.beginPath(); ctx.moveTo(x, y + h * g / 4); ctx.lineTo(x + w, y + h * g / 4); ctx.stroke(); }
    var pts = []; for (var k = 0; k <= 12; k++) { var f = k / 12; pts.push([x + f * w, y + h * (.85 - f * .7 + (rnd(k + seed) - .5) * .12)]); }
    var m = prog * 12, gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(52,227,160,.28)'); gr.addColorStop(1, 'rgba(52,227,160,0)');
    ctx.beginPath(); ctx.moveTo(pts[0][0], y + h); for (var j = 0; j <= Math.floor(m); j++) ctx.lineTo(pts[j][0], pts[j][1]); var fr = m - Math.floor(m), last = Math.floor(m) < 12 ? [lerp(pts[Math.floor(m)][0], pts[Math.floor(m) + 1][0], fr), lerp(pts[Math.floor(m)][1], pts[Math.floor(m) + 1][1], fr)] : pts[12];
    ctx.lineTo(last[0], last[1]); ctx.lineTo(last[0], y + h); ctx.closePath(); ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = C.green; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var q = 1; q <= Math.floor(m); q++) ctx.lineTo(pts[q][0], pts[q][1]); ctx.lineTo(last[0], last[1]); ctx.stroke();
    ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(last[0], last[1], 5, 0, Math.PI * 2); ctx.fill();
  }
  var PANELS = [['ROAS', '4,2x', '+38%'], ['Costo por cliente', '−27%', 'vs. mes pasado'], ['Conversaciones', '+64%', 'este mes'], ['ROAS', '3,9x', '+22%'], ['Ventas atribuidas', '+41%', 'este mes'], ['ROAS', '4,6x', '+45%']];
  function command(ctx, t) {
    if (t < 18.4 || t > 27) return;
    var a = win(t, 18.5, 26.8, .5, .5), lt = t - 18.5; ctx.save(); ctx.globalAlpha = a;
    var ke = eo(p(t, 18.6, .6));
    txt(ctx, 'ASÍ TRABAJAMOS', W / 2, 330 - (1 - ke) * 16, { w: 700, s: 28, f: B, a: 'center', c: C.gold, sp: 10, al: ke });
    txt(ctx, 'Datos, no suerte.', W / 2, 430 - (1 - ke) * 16, { w: 900, s: 92, a: 'center', al: ke });
    // cámara: un dolly lento hacia adelante
    var dolly = 1 + .04 * eio(p(lt, 0, 8)); ctx.translate(W / 2, 900); ctx.scale(dolly, dolly); ctx.translate(-W / 2, -900);
    // pared de pantallas en perspectiva (3 columnas x 2 filas, inclinadas hacia el centro)
    for (var i = 0; i < 6; i++) {
      var col = i % 3, row = Math.floor(i / 3), k = eo5(p(t, 18.9 + i * .14, .6)); if (k <= 0) continue;
      var w = 300, h = 210, x = 60 + col * 325, y = 520 + row * 240, skew = (col - 1) * .09;
      ctx.save(); ctx.globalAlpha *= k; ctx.translate(x + w / 2, y + h / 2); ctx.transform(1, skew * .5, 0, 1, 0, 0); ctx.scale(col === 1 ? 1 : .94, col === 1 ? 1 : .94); ctx.translate(-w / 2, -h / 2 + (1 - k) * 40);
      glass(ctx, 0, 0, w, h, 18, 'rgba(52,227,160,.45)');
      var pnl = PANELS[i], up = eo(p(t, 19.3 + i * .18, 2.4));
      txt(ctx, pnl[0].toUpperCase(), 18, 34, { w: 700, s: 15, f: B, c: C.dim, sp: 2 });
      txt(ctx, pnl[1], 18, 84, { w: 900, s: 44, c: C.ink });
      txt(ctx, pnl[2], w - 18, 82, { w: 700, s: 18, f: B, a: 'right', c: C.green });
      miniChart(ctx, 18, 104, w - 36, 88, up, i * 13);
      ctx.restore();
    }
    // sesión 1 a 1 en vivo
    var ks = eo5(p(t, 20.4, .7));
    if (ks > 0) {
      var x = 90, y = 1020, w = 900, h = 360; ctx.save(); ctx.globalAlpha *= ks; ctx.translate(0, (1 - ks) * 50);
      glass(ctx, x, y, w, h, 30, 'rgba(232,184,90,.55)');
      ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(x + 46, y + 48, 9 * (1 + .25 * Math.sin(t * 6)), 0, Math.PI * 2); ctx.fill();
      txt(ctx, 'EN VIVO · SESIÓN 1 A 1', x + 66, y + 57, { w: 700, s: 22, f: B, c: C.ink, sp: 3 });
      txt(ctx, '00:' + String(18 + Math.floor(lt)).padStart(2, '0') + ':' + String(Math.floor((lt % 1) * 60)).padStart(2, '0'), x + w - 40, y + 57, { w: 600, s: 22, f: B, a: 'right', c: C.mut });
      // dos videos: mentor y dueño (siluetas con luz de borde, sin caricaturas)
      [[x + 30, 'Mentor'], [x + 30 + 430, 'Vos']].forEach(function (v, j) {
        var vx = v[0], vy = y + 84, vw = 410, vh = 250;
        var g = ctx.createLinearGradient(vx, vy, vx + vw, vy + vh); g.addColorStop(0, j ? '#1a2230' : '#2a2116'); g.addColorStop(1, '#0b0d12'); ctx.fillStyle = g; rr(ctx, vx, vy, vw, vh, 18); ctx.fill();
        ctx.save(); rr(ctx, vx, vy, vw, vh, 18); ctx.clip();
        var sx = vx + vw / 2, sy = vy + vh * .55 + Math.sin(t * 1.5 + j) * 2;
        var rim = ctx.createRadialGradient(sx - 40, sy - 60, 10, sx, sy, 160); rim.addColorStop(0, j ? 'rgba(110,150,255,.35)' : 'rgba(232,184,90,.4)'); rim.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rim; ctx.fillRect(vx, vy, vw, vh);
        ctx.fillStyle = '#07080b'; ctx.beginPath(); ctx.arc(sx, sy - 40, 46, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(sx, sy + 110, 110, 90, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = j ? 'rgba(110,150,255,.5)' : 'rgba(232,184,90,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy - 40, 46, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(ctx, vx + 14, vy + vh - 48, 120, 34, 17); ctx.fill(); txt(ctx, v[1], vx + 74, vy + vh - 24, { w: 700, s: 20, f: B, a: 'center' });
        // onda de voz del que habla
        if ((Math.floor(t * 1.2) % 2) === j) for (var b = 0; b < 5; b++) { var bh = 8 + Math.abs(Math.sin(t * 9 + b * 1.3)) * 22; ctx.fillStyle = C.green; rr(ctx, vx + vw - 70 + b * 10, vy + vh - 31 - bh / 2, 6, bh, 3); ctx.fill(); }
      });
      ctx.restore();
    }
    // pilares
    var P4 = ['Bajo contrato', 'Acompañamiento 1 a 1', 'Resultados demostrables', 'Transparencia total'];
    P4.forEach(function (s, i) {
      var k = eo5(p(t, 22.4 + i * .4, .5)); if (k <= 0) return;
      var x = i % 2 ? 555 : 90, y = 1440 + Math.floor(i / 2) * 66;
      ctx.save(); ctx.globalAlpha *= k; ctx.translate((1 - k) * 30, 0);
      ctx.strokeStyle = C.green; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 9, y - 3); ctx.lineTo(x + 26, y - 22); ctx.stroke();
      txt(ctx, s, x + 42, y, { w: 600, s: 32, f: B });
      ctx.restore();
    });
    ctx.restore();
  }

  // ------------------------------------------------------------ cierre
  function cta(ctx, t) {
    if (t < 26.6) return;
    var k1 = eo5(p(t, 26.8, .7)), k2 = eo5(p(t, 27.8, .7)), k3 = eo5(p(t, 28.7, .6));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 470, W, 230); ctx.clip();
    txt(ctx, 'No tengo nada', W / 2, 570 + (1 - k1) * 110, { w: 900, s: 92, a: 'center' });
    txt(ctx, 'más que decir.', W / 2, 670 + (1 - k1) * 110, { w: 900, s: 92, a: 'center', c: C.mut });
    ctx.restore();
    mark(ctx, W / 2, 900, 100, 27.6, t);
    ctx.save(); ctx.globalAlpha = k2;
    txt(ctx, 'SUMATE A', W / 2, 1110, { w: 700, s: 28, f: B, a: 'center', c: C.mut, sp: 10 });
    var fs = 128; font(ctx, 900, fs, D, 8); var s = 'LA MESA CHICA', tw = ctx.measureText(s).width;
    if (tw > W - 150) { fs = Math.floor(fs * (W - 150) / tw); font(ctx, 900, fs, D, 6); tw = ctx.measureText(s).width; } ctx.fillStyle = goldG(ctx, W / 2 - tw / 2, W / 2 + tw / 2); ctx.textAlign = 'center'; ctx.fillText(s, W / 2, 1250 + (1 - k2) * 20);
    ctx.restore();
    if (k3 > 0) {
      var bw = 560, bh = 116, y = 1420, sh = (t * .6) % 1;
      ctx.save(); ctx.globalAlpha = k3; ctx.translate(W / 2, y + (1 - k3) * 30);
      ctx.shadowColor = 'rgba(232,184,90,.45)'; ctx.shadowBlur = 40; ctx.fillStyle = goldG(ctx, -bw / 2, bw / 2); rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.save(); rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.clip(); var sx = -bw / 2 - 120 + sh * (bw + 240); var sg = ctx.createLinearGradient(sx - 60, 0, sx + 60, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,.5)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(sx - 60, -bh / 2, 120, bh); ctx.restore();
      txt(ctx, 'Hacé click y sumate', -24, 16, { w: 800, s: 44, a: 'center', c: '#1a1205' });
      ctx.strokeStyle = '#1a1205'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; var bob = 5 * Math.sin(t * 6); ctx.beginPath(); ctx.moveTo(206, -16 + bob); ctx.lineTo(206, 16 + bob); ctx.moveTo(194, 4 + bob); ctx.lineTo(206, 16 + bob); ctx.lineTo(218, 4 + bob); ctx.stroke();
      ctx.restore();
    }
  }

  function cut(ctx, t) { [11.05, 15.05, 18.5, 26.75].forEach(function (s0) { var k = 1 - p(t, s0, .5); if (t >= s0 && k > 0) { ctx.fillStyle = 'rgba(255,235,200,' + (.09 * k) + ')'; ctx.fillRect(0, 0, W, H); } }); }

  function draw(ctx, t) {
    ctx.save(); bg(ctx, t);
    // micro-movimiento de cámara en el problema
    var shake = (1 - warm(t)) * 1.2; ctx.translate(Math.sin(t * 7.1) * shake, Math.cos(t * 6.3) * shake);
    stage(ctx, t, 0, function (lt) { painPhone(ctx, t, lt); });
    stage(ctx, t, 1, function (lt) { painAds(ctx, t, lt); });
    stage(ctx, t, 2, function (lt) { painScale(ctx, t, lt); });
    stage(ctx, t, 3, function (lt) { painStuck(ctx, t, lt); });
    stage(ctx, t, 4, function (lt) { painCreatives(ctx, t, lt); });
    ctx.restore();
    grade(ctx, t);
    ctx.save(); var sh2 = (1 - warm(t)) * 1.2; ctx.translate(Math.sin(t * 7.1) * sh2, Math.cos(t * 6.3) * sh2); hook(ctx, t); painCaption(ctx, t); ctx.restore();
    ctx.save(); turn(ctx, t); logo(ctx, t); command(ctx, t); cta(ctx, t); ctx.restore();
    cut(ctx, t); post(ctx, t);
  }
  window.ANIM = { W: W, H: H, DUR: DUR, draw: draw };
})();
