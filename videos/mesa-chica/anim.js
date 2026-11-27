// Anuncio animado "La Mesa Chica" · 1080x1920 · 30 fps · 30 s
// Se dibuja cuadro por cuadro en un canvas: draw(ctx, t) pinta el instante t (en segundos).
(function () {
  'use strict';
  var W = 1080, H = 1920, DUR = 30;
  var C = { bg: '#06080d', bg2: '#0c1220', ink: '#f5f7fb', muted: 'rgba(245,247,251,.62)', gold: '#f5c451', gold2: '#ffdf8f', red: '#ff5d5d', green: '#2ee59d', line: 'rgba(255,255,255,.10)', card: 'rgba(255,255,255,.055)' };
  var D = '"Inter Tight", Inter, sans-serif', B = 'Inter, sans-serif';

  // ------------------------------------------------------------ utilidades de animación
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function p(t, a, d) { return clamp((t - a) / d, 0, 1); }                       // progreso 0..1 entre a y a+d
  function eo(x) { return 1 - Math.pow(1 - x, 3); }                                // ease out cubic
  function eio(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function back(x) { var c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  function lerp(a, b, x) { return a + (b - a) * x; }
  function win(t, a, b, fi, fo) { return Math.min(eo(p(t, a, fi || .35)), 1 - eio(p(t, b - (fo || .35), fo || .35))); } // visible en [a,b]
  function font(ctx, w, s, f) { ctx.font = w + ' ' + s + 'px ' + (f || D); try { ctx.letterSpacing = (f === B ? 0 : -s * .03) + 'px'; } catch (e) {} }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function txt(ctx, s, x, y, o) {
    o = o || {}; font(ctx, o.w || 800, o.s || 80, o.f); ctx.textAlign = o.a || 'center'; ctx.textBaseline = 'alphabetic';
    if (o.sp != null) try { ctx.letterSpacing = o.sp + 'px'; } catch (e) {}
    var base = ctx.globalAlpha; ctx.fillStyle = o.c || C.ink; ctx.globalAlpha = base * (o.al == null ? 1 : o.al); ctx.fillText(s, x, y); ctx.globalAlpha = base;
    return ctx.measureText(s).width;
  }
  function goldGrad(ctx, x0, x1) { var g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#e9a93a'); g.addColorStop(.5, C.gold2); g.addColorStop(1, C.gold); return g; }

  // ------------------------------------------------------------ fondo vivo
  var grainC = null;
  function grain() {
    if (grainC) return grainC; grainC = document.createElement('canvas'); grainC.width = grainC.height = 256;
    var g = grainC.getContext('2d'), d = g.createImageData(256, 256), s = 7;
    for (var i = 0; i < d.data.length; i += 4) { s = (s * 16807) % 2147483647; var v = s % 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); return grainC;
  }
  function bg(ctx, t, tint) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    var a = t * .25, x1 = W * (.75 + .12 * Math.cos(a)), y1 = H * (.18 + .05 * Math.sin(a * 1.3));
    var g1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, 900); g1.addColorStop(0, tint || 'rgba(43,77,255,.42)'); g1.addColorStop(1, 'rgba(43,77,255,0)'); ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
    var x2 = W * (.2 + .1 * Math.sin(a * .8)), y2 = H * (.86 + .04 * Math.cos(a));
    var g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, 800); g2.addColorStop(0, 'rgba(245,196,81,.16)'); g2.addColorStop(1, 'rgba(245,196,81,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = .035; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; var off = (t * 12) % 72;
    for (var y = -72 + off; y < H; y += 72) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }
    for (var x = 36; x < W; x += 72) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); }
    ctx.restore();
    var v = ctx.createRadialGradient(W / 2, H / 2, W * .35, W / 2, H / 2, H * .75); v.addColorStop(0, 'rgba(6,8,13,0)'); v.addColorStop(1, 'rgba(6,8,13,.88)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  function grainOver(ctx, t) { ctx.save(); ctx.globalAlpha = .06; ctx.globalCompositeOperation = 'overlay'; var pt = ctx.createPattern(grain(), 'repeat'); ctx.translate((t * 997) % 256, (t * 613) % 256); ctx.fillStyle = pt; ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore(); }

  // ------------------------------------------------------------ íconos
  function iconX(ctx, x, y, r, k) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(255,93,93,.16)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.red; ctx.lineWidth = r * .16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * .33, -r * .33); ctx.lineTo(r * .33, r * .33); ctx.moveTo(r * .33, -r * .33); ctx.lineTo(-r * .33, r * .33); ctx.stroke(); ctx.restore();
  }
  function iconCheck(ctx, x, y, r, k, dp) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(46,229,157,.16)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.green; ctx.lineWidth = r * .16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var pts = [[-r * .38, r * .02], [-r * .1, r * .3], [r * .4, -r * .3]], L1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), L2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]), d = (dp == null ? 1 : dp) * (L1 + L2);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    if (d <= L1) ctx.lineTo(lerp(pts[0][0], pts[1][0], d / L1), lerp(pts[0][1], pts[1][1], d / L1));
    else { ctx.lineTo(pts[1][0], pts[1][1]); ctx.lineTo(lerp(pts[1][0], pts[2][0], (d - L1) / L2), lerp(pts[1][1], pts[2][1], (d - L1) / L2)); }
    ctx.stroke(); ctx.restore();
  }
  // La marca: una mesa redonda con sillas alrededor (la "mesa chica")
  function mesa(ctx, x, y, r, t0, t) {
    var k = eo(p(t, t0, .7));
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = goldGrad(ctx, -r, r); ctx.lineWidth = r * .09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r * .55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
    for (var i = 0; i < 8; i++) {
      var kk = back(p(t, t0 + .35 + i * .07, .35)); if (kk <= 0) continue;
      var a = -Math.PI / 2 + i * Math.PI / 4; ctx.fillStyle = i === 0 ? C.gold2 : 'rgba(245,196,81,.75)';
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * .88, Math.sin(a) * r * .88, r * .1 * kk, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ escenas
  var PAINS = [['WhatsApp que se caen'], ['Pauta sin estructura'], ['No poder escalar'], ['Tu panel estancado', 'en la misma facturación'], ['Creativos que no convierten']];
  var PILLARS = [['Bajo contrato', 'Todo por escrito, sin sorpresas'], ['Resultados reales', 'Demostrables, con números'], ['Acompañamiento 1 a 1', '100% personalizado'], ['Transparencia total', 'Ves los resultados en el día a día']];

  function sceneHook(ctx, t) {
    // 0 → 3 s: "¿Estás cansado de…?" entra palabra por palabra; a los 3 s sube y queda como título de la lista
    if (t > 11.2) return;
    var up = eio(p(t, 2.7, .6)), fade = 1 - eio(p(t, 10.2, .5));
    var cy = lerp(880, 430, up), sc = lerp(1, .56, up);
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(W / 2, cy); ctx.scale(sc, sc);
    var words = [['¿Estás', 0, -150, C.ink], ['cansado', .25, 20, C.red], ['de…?', .5, 190, C.ink]];
    words.forEach(function (w) {
      var k = back(p(t, .15 + w[1], .55)); if (k <= 0) return;
      ctx.save(); ctx.translate(0, w[2] + (1 - k) * 80); ctx.globalAlpha *= clamp(k, 0, 1);
      if (w[0] === 'cansado') {
        font(ctx, 900, 210); var tw = ctx.measureText(w[0]).width, mk = eo(p(t, .85, .45));
        ctx.save(); ctx.rotate(-.025); ctx.fillStyle = C.red; rr(ctx, -tw / 2 - 26, -170, (tw + 52) * mk, 210, 24); ctx.fill(); ctx.restore();
        txt(ctx, w[0], 0, 0, { w: 900, s: 210, c: mk > .5 ? '#fff' : C.red });
      } else txt(ctx, w[0], 0, 0, { w: 900, s: 210 });
      ctx.restore();
    });
    ctx.restore();
  }

  function scenePains(ctx, t) {
    if (t < 3.1 || t > 11.4) return;
    var fade = 1 - eio(p(t, 10.2, .55)), y0 = 680, gap = 172;
    PAINS.forEach(function (it, i) {
      var t0 = 3.3 + i * 1.25, k = eo(p(t, t0, .55)); if (k <= 0) return;
      var two = it.length > 1, h = two ? 190 : 140, y = y0 + i * gap + (i > 3 ? 50 : 0), x = 90 + (1 - k) * -120;
      var struck = eio(p(t, 9.3 + i * .12, .45)), dim = 1 - .45 * struck;
      ctx.save(); ctx.globalAlpha = k * fade * dim;
      ctx.fillStyle = C.card; rr(ctx, x, y, W - 180, h - 22, 32); ctx.fill();
      ctx.strokeStyle = 'rgba(255,93,93,' + (.18 + .3 * struck) + ')'; ctx.lineWidth = 2; rr(ctx, x, y, W - 180, h - 22, 32); ctx.stroke();
      iconX(ctx, x + 78, y + (h - 22) / 2, 40, back(p(t, t0 + .1, .45)));
      txt(ctx, it[0], x + 150, y + (two ? 74 : (h - 22) / 2 + 22), { w: 700, s: 58, a: 'left' });
      if (two) txt(ctx, it[1], x + 150, y + 140, { w: 700, s: 58, a: 'left', c: C.muted });
      if (struck > 0) { ctx.strokeStyle = C.red; ctx.lineWidth = 7; ctx.lineCap = 'round'; (two ? [y + 54, y + 120] : [y + (h - 22) / 2]).forEach(function (sy, j) { var ks = two ? clamp(struck * 2 - j, 0, 1) : struck; if (ks <= 0) return; ctx.beginPath(); ctx.moveTo(x + 140, sy); ctx.lineTo(x + 140 + (W - 360) * ks, sy - 5); ctx.stroke(); }); }
      ctx.restore();
    });
  }

  function sceneCount(ctx, t) {
    if (t < 10.9 || t > 15.1) return;
    var a = win(t, 10.9, 14.9, .4, .4), zoom = lerp(1.08, 1, eo(p(t, 11, 1)));
    ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 960); ctx.scale(zoom, zoom);
    txt(ctx, 'Por eso', 0, -360, { w: 600, s: 60, f: B, c: C.muted, al: eo(p(t, 11.1, .4)) });
    var n = Math.round(30 * eo(p(t, 11.4, 1.3))), s = '+' + n;
    font(ctx, 900, 420); var tw = ctx.measureText(s).width, kn = back(p(t, 11.3, .5));
    ctx.save(); ctx.globalAlpha *= clamp(kn, 0, 1); ctx.translate(0, 90); ctx.scale(lerp(.8, 1, clamp(kn, 0, 1.2)), lerp(.8, 1, clamp(kn, 0, 1.2)));
    ctx.fillStyle = goldGrad(ctx, -tw / 2, tw / 2); ctx.textAlign = 'center'; ctx.fillText(s, 0, 0); ctx.restore();
    var k2 = eo(p(t, 12.6, .5)); txt(ctx, 'dueños de paneles', 0, 230 + (1 - k2) * 30, { w: 800, s: 86, al: k2 });
    var k3 = eo(p(t, 13.1, .5)); txt(ctx, 'ya están en', 0, 330 + (1 - k3) * 30, { w: 600, s: 60, f: B, c: C.muted, al: k3 });
    ctx.restore();
  }

  function sceneLogo(ctx, t) {
    if (t < 14.6 || t > 18.6) return;
    var a = win(t, 14.7, 18.4, .3, .45);
    ctx.save(); ctx.globalAlpha = a;
    mesa(ctx, W / 2, 640, 190, 14.8, t);
    var lw = eo(p(t, 15.2, .6)); ctx.fillStyle = goldGrad(ctx, W / 2 - 320, W / 2 + 320); ctx.fillRect(W / 2 - 320 * lw, 900, 640 * lw, 4);
    ['LA MESA', 'CHICA'].forEach(function (s, i) {
      var k = eo(p(t, 15.35 + i * .2, .6)); if (k <= 0) return;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 930 + i * 185, W, 185); ctx.clip();
      font(ctx, 900, 190); try { ctx.letterSpacing = '6px'; } catch (e) {}
      var tw = ctx.measureText(s).width; ctx.fillStyle = i ? goldGrad(ctx, W / 2 - tw / 2, W / 2 + tw / 2) : C.ink; ctx.textAlign = 'center';
      ctx.fillText(s, W / 2, 1090 + i * 185 + (1 - k) * 190); ctx.restore();
    });
    var k4 = eo(p(t, 16.3, .6)); txt(ctx, 'La escuela digital para', W / 2, 1420 + (1 - k4) * 20, { w: 600, s: 52, f: B, c: C.muted, al: k4 });
    txt(ctx, 'dueños de paneles', W / 2, 1490 + (1 - k4) * 20, { w: 700, s: 52, f: B, al: k4 });
    ctx.restore();
  }

  function scenePillars(ctx, t) {
    if (t < 18.3 || t > 25.6) return;
    var a = win(t, 18.4, 25.4, .35, .5);
    ctx.save(); ctx.globalAlpha = a;
    var ke = eo(p(t, 18.5, .5)); txt(ctx, 'CÓMO TRABAJAMOS', W / 2, 400 - (1 - ke) * 20, { w: 700, s: 36, f: B, c: C.gold, sp: 8, al: ke });
    txt(ctx, 'Sin humo.', W / 2, 520 - (1 - ke) * 20, { w: 900, s: 104, al: ke });
    PILLARS.forEach(function (it, i) {
      var t0 = 19.1 + i * 1.15, k = eo(p(t, t0, .55)); if (k <= 0) return;
      var y = 640 + i * 228, x = 90, w = W - 180;
      ctx.save(); ctx.globalAlpha = k * a; ctx.translate(0, (1 - k) * 60);
      ctx.fillStyle = C.card; rr(ctx, x, y, w, 196, 34); ctx.fill();
      var gl = ctx.createLinearGradient(x, 0, x + w, 0); gl.addColorStop(0, 'rgba(46,229,157,.45)'); gl.addColorStop(1, 'rgba(46,229,157,.05)');
      ctx.strokeStyle = gl; ctx.lineWidth = 2; rr(ctx, x, y, w, 196, 34); ctx.stroke();
      iconCheck(ctx, x + 92, y + 98, 46, back(p(t, t0 + .05, .45)), eo(p(t, t0 + .2, .45)));
      txt(ctx, it[0], x + 176, y + 88, { w: 800, s: 60, a: 'left' });
      txt(ctx, it[1], x + 176, y + 146, { w: 500, s: 40, f: B, a: 'left', c: C.muted });
      ctx.restore();
    });
    ctx.restore();
  }

  function sceneCTA(ctx, t) {
    if (t < 25.2) return;
    var k1 = eo(p(t, 25.4, .5)), k2 = eo(p(t, 26.4, .6)), k3 = back(p(t, 27.2, .6));
    txt(ctx, 'No tengo nada', W / 2, 560 + (1 - k1) * 30, { w: 800, s: 88, al: k1 });
    txt(ctx, 'más que decir.', W / 2, 660 + (1 - k1) * 30, { w: 800, s: 88, al: k1, c: C.muted });
    mesa(ctx, W / 2, 900, 110, 26.2, t);
    ctx.save(); ctx.globalAlpha = k2;
    txt(ctx, 'Sumate a', W / 2, 1120 + (1 - k2) * 24, { w: 600, s: 56, f: B, c: C.muted });
    font(ctx, 900, 150); try { ctx.letterSpacing = '4px'; } catch (e) {} var s = 'LA MESA CHICA', tw = ctx.measureText(s).width, sz = 150;
    if (tw > W - 140) { sz = Math.floor(150 * (W - 140) / tw); font(ctx, 900, sz); try { ctx.letterSpacing = '3px'; } catch (e) {} tw = ctx.measureText(s).width; }
    ctx.fillStyle = goldGrad(ctx, W / 2 - tw / 2, W / 2 + tw / 2); ctx.textAlign = 'center'; ctx.fillText(s, W / 2, 1265 + (1 - k2) * 24);
    ctx.restore();
    if (k3 > 0) {
      var pulse = 1 + .035 * Math.sin((t - 27.2) * 6.3) * p(t, 27.8, .3), bw = 620, bh = 132;
      ctx.save(); ctx.translate(W / 2, 1440); ctx.scale(k3 * pulse, k3 * pulse);
      ctx.shadowColor = 'rgba(46,229,157,.45)'; ctx.shadowBlur = 50; ctx.fillStyle = C.green; rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill(); ctx.shadowBlur = 0;
      txt(ctx, 'Hacé click y sumate', -30, 18, { w: 800, s: 50, c: '#04150e' });
      ctx.strokeStyle = '#04150e'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      var ax = 225, bob = 6 * Math.sin((t - 27.2) * 6.3); ctx.beginPath(); ctx.moveTo(ax, -18 + bob); ctx.lineTo(ax, 18 + bob); ctx.moveTo(ax - 14, 4 + bob); ctx.lineTo(ax, 18 + bob); ctx.lineTo(ax + 14, 4 + bob); ctx.stroke();
      ctx.restore();
    }
  }

  function header(ctx, t) {
    // etiqueta fija arriba (fuera de la zona de la interfaz de Instagram)
    var k = eo(p(t, .1, .5)) * (1 - eio(p(t, 2.4, .35))) + eo(p(t, 18.5, .5)) * (1 - eio(p(t, 25.2, .4)));
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(k, 0, 1);
    font(ctx, 700, 30, B); try { ctx.letterSpacing = '6px'; } catch (e) {} var s = 'PARA DUEÑOS DE PANELES', tw = ctx.measureText(s).width;
    ctx.fillStyle = 'rgba(245,196,81,.12)'; rr(ctx, W / 2 - tw / 2 - 30, 262, tw + 60, 64, 32); ctx.fill();
    ctx.strokeStyle = 'rgba(245,196,81,.35)'; ctx.lineWidth = 2; rr(ctx, W / 2 - tw / 2 - 30, 262, tw + 60, 64, 32); ctx.stroke();
    ctx.fillStyle = C.gold; ctx.textAlign = 'center'; ctx.fillText(s, W / 2, 305); ctx.restore();
  }

  function flash(ctx, t) {
    // destello suave en los cambios de escena grandes
    [11, 14.7, 25.3].forEach(function (s0) { var k = 1 - p(t, s0, .35); if (t >= s0 && k > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (.10 * k) + ')'; ctx.fillRect(0, 0, W, H); } });
  }

  function draw(ctx, t) {
    ctx.save();
    var tint = t > 14.6 && t < 18.6 ? 'rgba(245,196,81,.30)' : t > 18.3 && t < 25.5 ? 'rgba(46,229,157,.22)' : t < 11 ? 'rgba(255,93,93,.20)' : null;
    bg(ctx, t, tint);
    header(ctx, t);
    sceneHook(ctx, t); scenePains(ctx, t); sceneCount(ctx, t); sceneLogo(ctx, t); scenePillars(ctx, t); sceneCTA(ctx, t);
    flash(ctx, t); grainOver(ctx, t);
    ctx.restore();
  }
  window.ANIM = { W: W, H: H, DUR: DUR, draw: draw };
})();
