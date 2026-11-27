// "La Mesa Chica" v2 · historia ilustrada · 1080x1920 · 30 fps · 32 s
// Escenas: dueño triste con sus problemas → +30 dueños → marca → sala de alumnos con PCs y ROAS → llamado a la acción.
(function () {
  'use strict';
  var W = 1080, H = 1920, DUR = 32;
  var C = { ink: '#f5f7fb', muted: 'rgba(245,247,251,.66)', gold: '#f5c451', gold2: '#ffdf8f', red: '#ff5d5d', green: '#2ee59d', blue: '#5b7cff' };
  var D = '"Inter Tight", Inter, sans-serif', B = 'Inter, sans-serif';

  // ------------------------------------------------------------ utilidades
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function p(t, a, d) { return clamp((t - a) / d, 0, 1); }
  function eo(x) { return 1 - Math.pow(1 - x, 3); }
  function eio(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function back(x) { var c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  function lerp(a, b, x) { return a + (b - a) * x; }
  function win(t, a, b, fi, fo) { return Math.min(eo(p(t, a, fi || .35)), 1 - eio(p(t, b - (fo || .35), fo || .35))); }
  function mix(c1, c2, k) { var a = hx(c1), b = hx(c2); return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(lerp(a[i], b[i], k)); }).join(',') + ')'; }
  function hx(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function font(ctx, w, s, f) { ctx.font = w + ' ' + s + 'px ' + (f || D); try { ctx.letterSpacing = (f === B ? 0 : -s * .03) + 'px'; } catch (e) {} }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function txt(ctx, s, x, y, o) {
    o = o || {}; font(ctx, o.w || 800, o.s || 80, o.f); ctx.textAlign = o.a || 'center'; ctx.textBaseline = 'alphabetic';
    if (o.sp != null) try { ctx.letterSpacing = o.sp + 'px'; } catch (e) {}
    var base = ctx.globalAlpha; ctx.globalAlpha = base * (o.al == null ? 1 : o.al); ctx.fillStyle = o.c || C.ink; ctx.fillText(s, x, y); ctx.globalAlpha = base;
    return ctx.measureText(s).width;
  }
  function goldGrad(ctx, x0, x1) { var g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#e9a93a'); g.addColorStop(.5, C.gold2); g.addColorStop(1, C.gold); return g; }
  var grainC = null;
  function grain() { if (grainC) return grainC; grainC = document.createElement('canvas'); grainC.width = grainC.height = 256; var g = grainC.getContext('2d'), d = g.createImageData(256, 256), s = 7; for (var i = 0; i < d.data.length; i += 4) { s = (s * 16807) % 2147483647; var v = s % 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); return grainC; }

  // ------------------------------------------------------------ fondo: frío y triste → cálido y vivo
  function warmth(t) { return eio(p(t, 11, 3.5)); } // 0 = noche fría, 1 = luz cálida
  function bg(ctx, t) {
    var w = warmth(t);
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, mix('#0b1220', '#120d08', w)); g.addColorStop(1, mix('#05070c', '#07060a', w)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var a = t * .22, cx = W * (.72 + .1 * Math.cos(a)), cy = H * (.2 + .04 * Math.sin(a));
    var r1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 950);
    r1.addColorStop(0, w < .5 ? 'rgba(70,100,160,' + (.32 * (1 - w)) + ')' : 'rgba(245,170,70,' + (.30 * w) + ')'); r1.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H);
    if (w > 0) { var r2 = ctx.createRadialGradient(W * .2, H * .9, 0, W * .2, H * .9, 850); r2.addColorStop(0, 'rgba(46,229,157,' + (.14 * w) + ')'); r2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H); }
  }
  function finish(ctx, t) {
    var v = ctx.createRadialGradient(W / 2, H / 2, W * .3, W / 2, H / 2, H * .78); v.addColorStop(0, 'rgba(5,6,10,0)'); v.addColorStop(1, 'rgba(5,6,10,.85)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = .06; ctx.globalCompositeOperation = 'overlay'; ctx.translate((t * 997) % 256, (t * 613) % 256); ctx.fillStyle = ctx.createPattern(grain(), 'repeat'); ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore();
  }

  // ------------------------------------------------------------ personajes
  var SKIN = ['#f1c7a3', '#e0ac85', '#c98d66', '#a66d4b', '#7c4f36'], HAIR = ['#1d1a1a', '#3b2416', '#6b4423', '#14110f', '#8a5a2b'], SHIRT = ['#3e5bff', '#2ee59d', '#f5c451', '#ff7a59', '#9f7aea', '#38d9f0', '#f472b6'];
  // persona de frente, sentada detrás de un escritorio (la línea del escritorio es y)
  function frontPerson(ctx, x, y, s, o) {
    var mood = o.mood || 'neutral', bob = o.bob || 0, slump = o.slump || 0;
    ctx.save(); ctx.translate(x, y);
    // torso
    ctx.fillStyle = o.shirt; rr(ctx, -s * .55, -s * (1.0 - slump * .12), s * 1.1, s * 1.1, s * .32); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.12)'; rr(ctx, -s * .08, -s * (1.0 - slump * .12), s * .16, s * .5, s * .08); ctx.fill();
    // cabeza
    var hx2 = 0, hy = -s * (1.32 - slump * .22) + bob, tilt = slump * .32;
    ctx.save(); ctx.translate(hx2, hy); ctx.rotate(tilt * .2);
    ctx.fillStyle = o.skin; ctx.beginPath(); ctx.arc(0, 0, s * .36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = o.hair; ctx.beginPath(); ctx.arc(0, -s * .04, s * .375, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-s * .14, -s * .25, s * .2, s * .1, -.3, 0, Math.PI * 2); ctx.fill();
    // cara
    ctx.strokeStyle = '#2a1d17'; ctx.fillStyle = '#2a1d17'; ctx.lineWidth = s * .035; ctx.lineCap = 'round';
    var ey = s * (mood === 'sad' ? .07 : .03);
    if (mood === 'sad') { [-1, 1].forEach(function (k) { ctx.beginPath(); ctx.arc(k * s * .13, ey, s * .05, Math.PI * 1.15, Math.PI * 1.85, false); ctx.stroke(); ctx.beginPath(); ctx.moveTo(k * s * .2, ey - s * .1); ctx.lineTo(k * s * .07, ey - s * .14); ctx.stroke(); }); ctx.beginPath(); ctx.arc(0, s * .27, s * .09, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    else { var bl = o.blink ? .2 : 1; [-1, 1].forEach(function (k) { ctx.beginPath(); ctx.ellipse(k * s * .13, ey, s * .035, s * .045 * bl, 0, 0, Math.PI * 2); ctx.fill(); }); ctx.beginPath(); ctx.arc(0, s * .12, s * .13, Math.PI * .15, Math.PI * .85); ctx.stroke(); ctx.fillStyle = 'rgba(255,120,120,.35)'; [-1, 1].forEach(function (k) { ctx.beginPath(); ctx.arc(k * s * .23, s * .13, s * .05, 0, Math.PI * 2); ctx.fill(); }); }
    ctx.restore();
    // brazos
    ctx.strokeStyle = o.shirt; ctx.lineCap = 'round'; ctx.lineWidth = s * .26;
    if (o.handHead) { ctx.beginPath(); ctx.moveTo(s * .4, -s * .7); ctx.quadraticCurveTo(s * .62, -s * .95, s * .24, hy + s * .02); ctx.stroke(); ctx.fillStyle = o.skin; ctx.beginPath(); ctx.arc(s * .2, hy - s * .02, s * .13, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-s * .45, -s * .6); ctx.lineTo(-s * .5, -s * .08); ctx.stroke(); }
    else if (o.point) { var ap = o.point; ctx.beginPath(); ctx.moveTo(-s * .45, -s * .7); ctx.lineTo(-s * (.75 + .25 * ap), -s * (1.05 + .3 * ap)); ctx.stroke(); ctx.fillStyle = o.skin; ctx.beginPath(); ctx.arc(-s * (.8 + .25 * ap), -s * (1.1 + .3 * ap), s * .12, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(s * .45, -s * .6); ctx.lineTo(s * .5, -s * .08); ctx.stroke(); }
    else { [-1, 1].forEach(function (k) { ctx.beginPath(); ctx.moveTo(k * s * .45, -s * .6); ctx.lineTo(k * s * .5, -s * .08); ctx.stroke(); }); }
    ctx.restore();
  }
  // persona de espaldas (para la sala: vemos su pantalla por encima del hombro)
  function backPerson(ctx, x, y, s, o) {
    ctx.save(); ctx.translate(x, y + (o.bob || 0));
    ctx.fillStyle = o.shirt; rr(ctx, -s * .6, -s * .55, s * 1.2, s * .9, s * .35); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.18)'; rr(ctx, -s * .6, -s * .55, s * 1.2, s * .2, s * .1); ctx.fill();
    ctx.fillStyle = o.skin; rr(ctx, -s * .12, -s * .72, s * .24, s * .25, s * .08); ctx.fill();
    ctx.fillStyle = o.hair; ctx.beginPath(); ctx.arc(0, -s * .95, s * .34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = o.skin; [-1, 1].forEach(function (k) { ctx.beginPath(); ctx.ellipse(k * s * .33, -s * .9, s * .06, s * .1, 0, 0, Math.PI * 2); ctx.fill(); });
    if (o.cheer) { ctx.strokeStyle = o.shirt; ctx.lineWidth = s * .22; ctx.lineCap = 'round'; var c = o.cheer; ctx.beginPath(); ctx.moveTo(s * .45, -s * .35); ctx.lineTo(s * (.55 + .15 * c), -s * (.35 + .9 * c)); ctx.stroke(); ctx.fillStyle = o.skin; ctx.beginPath(); ctx.arc(s * (.55 + .15 * c), -s * (.38 + .95 * c), s * .12, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // ------------------------------------------------------------ objetos
  function monitor(ctx, x, y, w, h, drawScreen) {
    ctx.fillStyle = '#1b2230'; rr(ctx, x - w / 2, y - h, w, h, w * .05); ctx.fill();
    ctx.fillStyle = '#0b0f17'; rr(ctx, x - w / 2 + w * .04, y - h + w * .04, w * .92, h - w * .08, w * .03); ctx.fill();
    ctx.save(); rr(ctx, x - w / 2 + w * .04, y - h + w * .04, w * .92, h - w * .08, w * .03); ctx.clip(); drawScreen(x - w / 2 + w * .04, y - h + w * .04, w * .92, h - w * .08); ctx.restore();
    ctx.fillStyle = '#1b2230'; ctx.fillRect(x - w * .05, y, w * .1, h * .14); rr(ctx, x - w * .2, y + h * .12, w * .4, h * .06, h * .03); ctx.fill();
  }
  function chart(ctx, x, y, w, h, kind, prog, t) {
    // kind: 'down' (rojo cayendo) o 'up' (verde subiendo)
    ctx.fillStyle = kind === 'up' ? 'rgba(46,229,157,.06)' : 'rgba(255,93,93,.06)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; for (var i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x, y + h * i / 4); ctx.lineTo(x + w, y + h * i / 4); ctx.stroke(); }
    var pts = [], n = 9;
    for (var j = 0; j < n; j++) { var f = j / (n - 1), base = kind === 'up' ? .82 - f * .62 : .22 + f * .62, wob = (rnd(j + (kind === 'up' ? 50 : 0)) - .5) * .16; pts.push([x + w * .06 + f * w * .88, y + h * clamp(base + wob, .08, .92)]); }
    var m = Math.max(1, Math.floor(prog * (n - 1) + 1)), fr = prog * (n - 1) - (m - 1);
    ctx.strokeStyle = kind === 'up' ? C.green : C.red; ctx.lineWidth = Math.max(2, w * .018); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var k = 1; k < m; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    if (m < n) ctx.lineTo(lerp(pts[m - 1][0], pts[m][0], fr), lerp(pts[m - 1][1], pts[m][1], fr));
    ctx.stroke();
    var last = m < n ? [lerp(pts[m - 1][0], pts[m][0], fr), lerp(pts[m - 1][1], pts[m][1], fr)] : pts[n - 1];
    ctx.fillStyle = kind === 'up' ? C.green : C.red; ctx.beginPath(); ctx.arc(last[0], last[1], Math.max(3, w * .025) * (1 + .25 * Math.sin(t * 8)), 0, Math.PI * 2); ctx.fill();
  }
  function phone(ctx, x, y, s, t, alert) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.18 + (alert ? Math.sin(t * 40) * .025 : 0));
    ctx.fillStyle = '#121722'; rr(ctx, -s * .3, -s * .55, s * .6, s * 1.1, s * .1); ctx.fill();
    ctx.fillStyle = alert ? 'rgba(255,93,93,.85)' : '#1e2a3b'; rr(ctx, -s * .26, -s * .5, s * .52, s * 1.0, s * .08); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(0, -s * .12, s * .13, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = alert ? C.red : '#1e2a3b'; ctx.lineWidth = s * .05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s * .06, -s * .18); ctx.lineTo(s * .06, -s * .06); ctx.moveTo(s * .06, -s * .18); ctx.lineTo(-s * .06, -s * .06); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; rr(ctx, -s * .18, s * .1, s * .36, s * .05, s * .02); ctx.fill(); rr(ctx, -s * .13, s * .2, s * .26, s * .05, s * .02); ctx.fill();
    ctx.restore();
  }
  function cloud(ctx, x, y, s, t, a) {
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x + Math.sin(t * 1.3) * 6, y);
    ctx.fillStyle = '#5d6b82'; [[-.5, .05, .36], [-.15, -.15, .46], [.3, -.05, .4], [.62, .1, .3], [0, .15, .4]].forEach(function (c) { ctx.beginPath(); ctx.arc(c[0] * s, c[1] * s, c[2] * s, 0, Math.PI * 2); ctx.fill(); });
    ctx.strokeStyle = 'rgba(120,160,220,.75)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (var i = 0; i < 9; i++) { var ph = (t * 1.6 + rnd(i) * 3) % 1, rx = (rnd(i + 9) - .5) * s * 1.6, ry = s * .4 + ph * s * 1.4; ctx.globalAlpha = a * (1 - ph) * .9; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 6, ry + 26); ctx.stroke(); }
    ctx.restore();
  }
  function tagBox(ctx, x, y, label, value, k, good) {
    if (k <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    font(ctx, 800, 30); var tw = ctx.measureText(label + ' ' + value).width + 44;
    ctx.shadowColor = good ? 'rgba(46,229,157,.5)' : 'rgba(255,93,93,.4)'; ctx.shadowBlur = 24; ctx.fillStyle = good ? C.green : C.red; rr(ctx, -tw / 2, -28, tw, 56, 28); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = good ? '#04150e' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label + ' ' + value, 0, 2); ctx.textBaseline = 'alphabetic'; ctx.restore();
  }

  // ------------------------------------------------------------ escena 1-2: el dueño con sus problemas
  var PAINS = ['WhatsApp que se caen', 'Pauta sin estructura', 'No poder escalar', 'Panel estancado en la misma facturación', 'Creativos que no convierten'];
  function sceneSad(ctx, t) {
    if (t > 12) return;
    var a = eo(p(t, .2, .8)) * (1 - eio(p(t, 10.8, .9)));
    ctx.save(); ctx.globalAlpha = a;
    var cx = W / 2, deskY = 1360;
    // ventana con lluvia de fondo
    ctx.fillStyle = 'rgba(40,55,80,.35)'; rr(ctx, 150, 640, 360, 420, 18); ctx.fill(); ctx.strokeStyle = 'rgba(120,150,200,.25)'; ctx.lineWidth = 6; rr(ctx, 150, 640, 360, 420, 18); ctx.stroke(); ctx.beginPath(); ctx.moveTo(330, 640); ctx.lineTo(330, 1060); ctx.moveTo(150, 850); ctx.lineTo(510, 850); ctx.stroke();
    ctx.save(); rr(ctx, 150, 640, 360, 420, 18); ctx.clip(); ctx.strokeStyle = 'rgba(150,180,230,.35)'; ctx.lineWidth = 2; for (var i = 0; i < 26; i++) { var ph = (t * 1.1 + rnd(i)) % 1, rx = 150 + rnd(i + 40) * 380, ry = 620 + ph * 470; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 8, ry + 30); ctx.stroke(); } ctx.restore();
    // lámpara que titila
    var fl = .55 + .45 * (Math.sin(t * 13) > .85 ? .2 : 1); ctx.fillStyle = 'rgba(255,220,150,' + (.10 * fl) + ')'; ctx.beginPath(); ctx.moveTo(790, 760); ctx.lineTo(640, 1360); ctx.lineTo(960, 1360); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a3242'; ctx.fillRect(782, 700, 16, 70); ctx.beginPath(); ctx.moveTo(740, 770); ctx.lineTo(840, 770); ctx.lineTo(815, 735); ctx.lineTo(765, 735); ctx.closePath(); ctx.fill();
    // persona triste
    var breath = Math.sin(t * 1.4) * 5;
    frontPerson(ctx, cx + 40, deskY - 10, 230, { mood: 'sad', skin: SKIN[1], hair: HAIR[0], shirt: '#4a5568', slump: 1, bob: breath, handHead: true });
    // monitor en ángulo con el gráfico cayendo
    var mp = (t * .32) % 1;
    monitor(ctx, cx - 250, deskY - 40, 300, 220, function (sx, sy, sw, sh) { chart(ctx, sx, sy, sw, sh, 'down', clamp(mp * 1.3, 0, 1), t); txt(ctx, 'VENTAS', sx + 18, sy + 34, { w: 700, s: 22, f: B, a: 'left', c: 'rgba(255,93,93,.9)' }); });
    // escritorio
    ctx.fillStyle = '#20283a'; rr(ctx, 120, deskY - 30, W - 240, 46, 14); ctx.fill(); ctx.fillStyle = '#161c2a'; ctx.fillRect(160, deskY + 16, 40, 230); ctx.fillRect(W - 200, deskY + 16, 40, 230);
    // celular con alerta
    var alertOn = (t > 3.2 && t < 4.8) || Math.sin(t * 3) > .6;
    phone(ctx, cx + 300, deskY - 90, 120, t, alertOn);
    if (alertOn) { ctx.strokeStyle = 'rgba(255,93,93,.5)'; ctx.lineWidth = 4; [1, 2].forEach(function (k) { ctx.beginPath(); ctx.arc(cx + 300, deskY - 90, 70 + k * 22 + (t * 60 % 20), -1.2, -.4); ctx.stroke(); }); }
    // nube con lluvia sobre su cabeza
    cloud(ctx, cx + 40, 760, 150, t, eo(p(t, 1.2, .8)));
    ctx.restore();
  }
  function sceneHook(ctx, t) {
    if (t > 11.6) return;
    var up = eio(p(t, 2.6, .6)), fade = 1 - eio(p(t, 10.4, .6)), cy = lerp(760, 380, up), sc = lerp(1, .5, up);
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(W / 2, cy); ctx.scale(sc, sc);
    [['¿Estás', 0, -150], ['cansado', .25, 20], ['de…?', .5, 190]].forEach(function (w) {
      var k = back(p(t, .15 + w[1], .55)); if (k <= 0) return;
      ctx.save(); ctx.translate(0, w[2] + (1 - k) * 80); ctx.globalAlpha *= clamp(k, 0, 1);
      if (w[0] === 'cansado') { font(ctx, 900, 200); var tw = ctx.measureText(w[0]).width, mk = eo(p(t, .85, .45)); ctx.save(); ctx.rotate(-.025); ctx.fillStyle = C.red; rr(ctx, -tw / 2 - 26, -162, (tw + 52) * mk, 200, 24); ctx.fill(); ctx.restore(); txt(ctx, w[0], 0, 0, { w: 900, s: 200, c: mk > .5 ? '#fff' : C.red }); }
      else txt(ctx, w[0], 0, 0, { w: 900, s: 200 });
      ctx.restore();
    });
    ctx.restore();
    // subtítulo con el dolor del momento
    if (t > 3.1 && t < 11) {
      var i = clamp(Math.floor((t - 3.1) / 1.5), 0, PAINS.length - 1), lt = (t - 3.1) - i * 1.5, k = eo(p(lt, 0, .35)) * (i === PAINS.length - 1 ? 1 - eio(p(t, 10.2, .5)) : 1 - eio(p(lt, 1.25, .25)));
      ctx.save(); ctx.globalAlpha = k; font(ctx, 800, 56); var s = PAINS[i], tw = ctx.measureText(s).width, bw = Math.min(W - 120, tw + 140), sz = tw + 140 > W - 120 ? 56 * (W - 260) / tw : 56;
      ctx.fillStyle = 'rgba(255,93,93,.14)'; rr(ctx, W / 2 - bw / 2, 560 + (1 - k) * 16, bw, 96, 48); ctx.fill(); ctx.strokeStyle = 'rgba(255,93,93,.45)'; ctx.lineWidth = 2; rr(ctx, W / 2 - bw / 2, 560 + (1 - k) * 16, bw, 96, 48); ctx.stroke();
      font(ctx, 800, sz); var tw2 = ctx.measureText(s).width; ctx.fillStyle = C.red; ctx.font = '900 ' + sz + 'px ' + D; ctx.textAlign = 'left'; ctx.fillText('✕', W / 2 - (tw2 + 60) / 2, 624 + (1 - k) * 16);
      txt(ctx, s, W / 2 + 30, 627 + (1 - k) * 16, { w: 800, s: sz });
      ctx.restore();
    }
  }

  // ------------------------------------------------------------ escena 3: +30 dueños, caras que aparecen
  function sceneCount(ctx, t) {
    if (t < 10.8 || t > 15.4) return;
    var a = win(t, 10.9, 15.2, .45, .45);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, 'Por eso', W / 2, 470, { w: 600, s: 60, f: B, c: C.muted, al: eo(p(t, 11, .4)) });
    var n = Math.round(30 * eo(p(t, 11.4, 1.4))), kn = back(p(t, 11.3, .5));
    ctx.save(); ctx.globalAlpha *= clamp(kn, 0, 1); ctx.translate(W / 2, 760); var sc = lerp(.8, 1, clamp(kn, 0, 1.2)); ctx.scale(sc, sc); font(ctx, 900, 330); var s = '+' + n, tw = ctx.measureText(s).width; ctx.fillStyle = goldGrad(ctx, -tw / 2, tw / 2); ctx.textAlign = 'center'; ctx.fillText(s, 0, 0); ctx.restore();
    var k2 = eo(p(t, 12.7, .5)); txt(ctx, 'dueños de paneles ya están en…', W / 2, 870 + (1 - k2) * 24, { w: 800, s: 54, al: k2 });
    // 30 caritas (6 x 5) que aparecen al ritmo del contador
    for (var i = 0; i < 30; i++) {
      var col = i % 6, row = Math.floor(i / 6), k = back(p(t, 11.45 + i * .045, .4)); if (k <= 0) continue;
      var x = 210 + col * 132, y = 1010 + row * 118, r = 44 * k;
      ctx.save(); ctx.translate(x, y + Math.sin(t * 3 + i) * 3);
      ctx.fillStyle = SHIRT[i % SHIRT.length]; ctx.globalAlpha *= .9; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = SKIN[i % SKIN.length]; ctx.beginPath(); ctx.arc(0, r * .05, r * .62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = HAIR[i % HAIR.length]; ctx.beginPath(); ctx.arc(0, -r * .05, r * .64, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a1d17'; [-1, 1].forEach(function (s2) { ctx.beginPath(); ctx.arc(s2 * r * .2, r * .07, r * .06, 0, Math.PI * 2); ctx.fill(); });
      ctx.strokeStyle = '#2a1d17'; ctx.lineWidth = r * .07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, r * .2, r * .2, .2 * Math.PI, .8 * Math.PI); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ escena 4: la marca
  function mesa(ctx, x, y, r, t0, t) {
    var k = eo(p(t, t0, .7)); ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = goldGrad(ctx, -r, r); ctx.lineWidth = r * .09; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r * .55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
    for (var i = 0; i < 8; i++) { var kk = back(p(t, t0 + .35 + i * .07, .35)); if (kk <= 0) continue; var an = -Math.PI / 2 + i * Math.PI / 4; ctx.fillStyle = i === 0 ? C.gold2 : 'rgba(245,196,81,.75)'; ctx.beginPath(); ctx.arc(Math.cos(an) * r * .88, Math.sin(an) * r * .88, r * .1 * kk, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function sceneLogo(ctx, t) {
    if (t < 15 || t > 18.8) return;
    var a = win(t, 15.05, 18.6, .3, .45);
    ctx.save(); ctx.globalAlpha = a;
    mesa(ctx, W / 2, 660, 190, 15.1, t);
    var lw = eo(p(t, 15.5, .6)); ctx.fillStyle = goldGrad(ctx, W / 2 - 320, W / 2 + 320); ctx.fillRect(W / 2 - 320 * lw, 910, 640 * lw, 4);
    ['LA MESA', 'CHICA'].forEach(function (s, i) {
      var k = eo(p(t, 15.65 + i * .2, .6)); if (k <= 0) return;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 940 + i * 185, W, 185); ctx.clip(); font(ctx, 900, 190); try { ctx.letterSpacing = '6px'; } catch (e) {}
      var tw = ctx.measureText(s).width; ctx.fillStyle = i ? goldGrad(ctx, W / 2 - tw / 2, W / 2 + tw / 2) : C.ink; ctx.textAlign = 'center'; ctx.fillText(s, W / 2, 1100 + i * 185 + (1 - k) * 190); ctx.restore();
    });
    var k4 = eo(p(t, 16.5, .6)); txt(ctx, 'La escuela digital para', W / 2, 1430 + (1 - k4) * 20, { w: 600, s: 52, f: B, c: C.muted, al: k4 }); txt(ctx, 'dueños de paneles', W / 2, 1500 + (1 - k4) * 20, { w: 700, s: 52, f: B, al: k4 });
    ctx.restore();
  }

  // ------------------------------------------------------------ escena 5: la sala con PCs, gente aprendiendo y ROAS buenos
  var ROAS = ['3,8x', '4,2x', '3,1x', '5,0x', '3,6x', '4,4x'];
  function sceneClass(ctx, t) {
    if (t < 18.4 || t > 27) return;
    var a = win(t, 18.5, 26.8, .5, .5), lt = t - 18.5;
    ctx.save(); ctx.globalAlpha = a;
    var ke = eo(p(t, 18.6, .5));
    txt(ctx, 'ASÍ SE APRENDE EN', W / 2, 330 - (1 - ke) * 20, { w: 700, s: 34, f: B, c: C.gold, sp: 8, al: ke });
    txt(ctx, 'La Mesa Chica', W / 2, 430 - (1 - ke) * 20, { w: 900, s: 96, al: ke });
    // pared con pantalla grande y el mentor
    var wallY = 500; ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fillRect(60, wallY, W - 120, 470);
    var big = eo(p(t, 18.9, .6));
    ctx.save(); ctx.globalAlpha *= big; monitor(ctx, 640, wallY + 330, 560, 300, function (sx, sy, sw, sh) { chart(ctx, sx, sy, sw, sh, 'up', eo(p(t, 19.2, 2.2)), t); txt(ctx, 'ROAS DEL GRUPO', sx + 22, sy + 40, { w: 800, s: 24, f: B, a: 'left', c: C.green }); }); ctx.restore();
    frontPerson(ctx, 230, wallY + 450, 150, { mood: 'happy', skin: SKIN[2], hair: HAIR[1], shirt: '#1f2937', point: .6 + .4 * Math.sin(t * 2.2), blink: (t % 3.1) < .12 });
    // dos filas de alumnos de espaldas con sus pantallas
    var rows = [{ y: 1110, s: 88, mw: 190, mh: 120, xs: [215, 425, 635, 850] }, { y: 1325, s: 110, mw: 232, mh: 148, xs: [235, 540, 845] }];
    var idx = 0;
    rows.forEach(function (r, ri) {
      ctx.fillStyle = ri ? '#2a2117' : '#231c14'; rr(ctx, 90, r.y - 22, W - 180, 26, 10); ctx.fill();
      r.xs.forEach(function (x, ci) {
        var i = idx++, kin = back(p(t, 19.4 + i * .18, .5)); if (kin <= 0) return;
        ctx.save(); ctx.globalAlpha *= clamp(kin, 0, 1); ctx.translate(0, (1 - clamp(kin, 0, 1)) * 40);
        var up = eo(p(t, 19.8 + i * .22, 2.2));
        monitor(ctx, x, r.y - 26, r.mw, r.mh, function (sx, sy, sw, sh) { chart(ctx, sx, sy, sw, sh, 'up', up, t + i); });
        var tagK = back(p(t, 21 + i * .35, .45)); if (tagK > 0) tagBox(ctx, x + r.mw * .18, r.y - 26 - r.mh - 14 + Math.sin(t * 2 + i) * 4, 'ROAS', ROAS[i % ROAS.length], tagK * (ri ? .9 : .75), true);
        var cheer = Math.max(0, Math.sin((t - 21.5 - i * .3) * 2.6)) * p(t, 21.5 + i * .3, .2);
        backPerson(ctx, x - r.mw * .05, r.y + r.s * .95, r.s, { skin: SKIN[(i + 1) % SKIN.length], hair: HAIR[(i + 2) % HAIR.length], shirt: SHIRT[(i + 1) % SHIRT.length], bob: Math.sin(t * 2.4 + i) * 3, cheer: i % 3 === 1 ? cheer : 0 });
        ctx.restore();
      });
    });
    // destellos de festejo
    if (t > 21.4) for (var s = 0; s < 18; s++) { var ph = (t * .7 + rnd(s)) % 1, sx2 = 120 + rnd(s + 30) * (W - 240), sy2 = 1000 + rnd(s + 60) * 520 - ph * 140; ctx.save(); ctx.globalAlpha *= (1 - ph) * .9 * p(t, 21.4, .6); ctx.fillStyle = s % 3 ? C.gold : C.green; ctx.translate(sx2, sy2); ctx.rotate(t * 2 + s); ctx.fillRect(-5, -5, 10, 10); ctx.restore(); }
    // los 4 pilares, en chips
    var P4 = ['Bajo contrato', 'Acompañamiento 1 a 1', 'Resultados reales', 'Transparencia total'];
    P4.forEach(function (s2, i) {
      var k = back(p(t, 22.6 + i * .45, .5)); if (k <= 0) return;
      var x = i % 2 ? W / 2 + 12 : 90, w = W / 2 - 102, y = i < 2 ? 1502 : 1570;
      ctx.save(); ctx.globalAlpha *= clamp(k, 0, 1); ctx.translate(x + w / 2, y); ctx.scale(clamp(k, 0, 1.1), clamp(k, 0, 1.1));
      ctx.fillStyle = 'rgba(12,30,24,.92)'; rr(ctx, -w / 2, -29, w, 58, 29); ctx.fill(); ctx.strokeStyle = 'rgba(46,229,157,.6)'; ctx.lineWidth = 2; rr(ctx, -w / 2, -29, w, 58, 29); ctx.stroke();
      txt(ctx, '✓ ' + s2, 0, 10, { w: 700, s: 29, f: B, c: C.ink });
      ctx.restore();
    });
    ctx.restore();
  }

  // ------------------------------------------------------------ escena 6: llamado a la acción
  function sceneCTA(ctx, t) {
    if (t < 26.6) return;
    var k1 = eo(p(t, 26.8, .5)), k2 = eo(p(t, 27.8, .6)), k3 = back(p(t, 28.6, .6));
    txt(ctx, 'No tengo nada', W / 2, 560 + (1 - k1) * 30, { w: 800, s: 88, al: k1 });
    txt(ctx, 'más que decir.', W / 2, 660 + (1 - k1) * 30, { w: 800, s: 88, al: k1, c: C.muted });
    mesa(ctx, W / 2, 900, 110, 27.6, t);
    ctx.save(); ctx.globalAlpha = k2;
    txt(ctx, 'Sumate a', W / 2, 1120 + (1 - k2) * 24, { w: 600, s: 56, f: B, c: C.muted });
    font(ctx, 900, 140); try { ctx.letterSpacing = '4px'; } catch (e) {} var s = 'LA MESA CHICA', tw = ctx.measureText(s).width;
    if (tw > W - 140) { font(ctx, 900, Math.floor(140 * (W - 140) / tw)); try { ctx.letterSpacing = '3px'; } catch (e) {} tw = ctx.measureText(s).width; }
    ctx.fillStyle = goldGrad(ctx, W / 2 - tw / 2, W / 2 + tw / 2); ctx.textAlign = 'center'; ctx.fillText(s, W / 2, 1265 + (1 - k2) * 24); ctx.restore();
    if (k3 > 0) {
      var pulse = 1 + .035 * Math.sin((t - 28.6) * 6.3) * p(t, 29.2, .3), bw = 620, bh = 132;
      ctx.save(); ctx.translate(W / 2, 1440); ctx.scale(k3 * pulse, k3 * pulse);
      ctx.shadowColor = 'rgba(46,229,157,.45)'; ctx.shadowBlur = 50; ctx.fillStyle = C.green; rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill(); ctx.shadowBlur = 0;
      txt(ctx, 'Hacé click y sumate', -30, 18, { w: 800, s: 50, c: '#04150e' });
      ctx.strokeStyle = '#04150e'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; var bob = 6 * Math.sin((t - 28.6) * 6.3); ctx.beginPath(); ctx.moveTo(225, -18 + bob); ctx.lineTo(225, 18 + bob); ctx.moveTo(211, 4 + bob); ctx.lineTo(225, 18 + bob); ctx.lineTo(239, 4 + bob); ctx.stroke();
      ctx.restore();
    }
  }

  function flash(ctx, t) { [11, 15.05, 18.5, 26.7].forEach(function (s0) { var k = 1 - p(t, s0, .4); if (t >= s0 && k > 0) { ctx.fillStyle = 'rgba(255,240,210,' + (.12 * k) + ')'; ctx.fillRect(0, 0, W, H); } }); }

  function draw(ctx, t) {
    ctx.save(); bg(ctx, t);
    sceneSad(ctx, t); sceneHook(ctx, t); sceneCount(ctx, t); sceneLogo(ctx, t); sceneClass(ctx, t); sceneCTA(ctx, t);
    flash(ctx, t); finish(ctx, t); ctx.restore();
  }
  window.ANIM = { W: W, H: H, DUR: DUR, draw: draw };
})();
