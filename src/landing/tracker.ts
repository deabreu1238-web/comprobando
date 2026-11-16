// Genera el script que el cliente pega en su landing:
//   <button onclick="openRandomLink()">Escribinos</button>
//   <script src="https://SERVIDOR/t/CLAVE_PUBLICA.js"></script>

export interface TrackerConfig {
  apiBase: string;
  publicKey: string;
  lines: { id: string; phone: string; weight: number }[];
  messageTemplate: string;
  pixelId: string | null;
}

export function trackerScript(cfg: TrackerConfig): string {
  const data = JSON.stringify({
    api: cfg.apiBase,
    k: cfg.publicKey,
    lines: cfg.lines,
    msg: cfg.messageTemplate,
    pixel: cfg.pixelId,
  });
  return `/* Comprobado: seguimiento de clics a WhatsApp */
(function () {
  'use strict';
  var C = ${data};
  var A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function cookie(n) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(n, v) {
    try { document.cookie = n + '=' + encodeURIComponent(v) + '; max-age=7776000; path=/; SameSite=Lax'; } catch (e) {}
  }
  var q = new URLSearchParams(location.search);
  var fbclid = q.get('fbclid');
  // _fbc: identificador del clic del anuncio, en el formato que pide Meta
  if (fbclid) {
    var prev = cookie('_fbc');
    if (!prev || prev.split('.').pop() !== fbclid) setCookie('_fbc', 'fb.1.' + Date.now() + '.' + fbclid);
  }
  var utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
    var v = q.get(k);
    if (v) { utm[k] = v; try { sessionStorage.setItem('cp_' + k, v); } catch (e) {} }
    else { try { v = sessionStorage.getItem('cp_' + k); if (v) utm[k] = v; } catch (e) {} }
  });

  // Píxel de Meta de la cuenta (una sola vez: no lo pegues también en el HTML)
  if (C.pixel && !window.fbq) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', C.pixel);
    window.fbq('track', 'PageView');
  }

  function code() {
    var out = '', b = new Uint8Array(8);
    (window.crypto || window.msCrypto).getRandomValues(b);
    for (var i = 0; i < 8; i++) out += A[b[i] % A.length];
    return out;
  }
  function pick() {
    var total = 0, i;
    for (i = 0; i < C.lines.length; i++) total += C.lines[i].weight;
    var r = Math.random() * total;
    for (i = 0; i < C.lines.length; i++) { r -= C.lines[i].weight; if (r < 0) return C.lines[i]; }
    return C.lines[0];
  }

  window.openRandomLink = function () {
    if (!C.lines.length) { alert('No hay números de WhatsApp activos.'); return; }
    var c = code(), line = pick();
    var body = JSON.stringify({ k: C.k, code: c, lineId: line.id, fbclid: fbclid, fbc: cookie('_fbc'), fbp: cookie('_fbp'), url: location.href, utm: utm });
    var sent = false;
    try { sent = navigator.sendBeacon(C.api + '/api/public/click', new Blob([body], { type: 'text/plain' })); } catch (e) {}
    if (!sent) { try { fetch(C.api + '/api/public/click', { method: 'POST', body: body, keepalive: true, headers: { 'content-type': 'text/plain' } }); } catch (e) {} }
    if (window.fbq) { try { window.fbq('track', 'Contact', {}, { eventID: 'contact-' + c }); } catch (e) {} }
    var text = C.msg.indexOf('{code}') >= 0 ? C.msg.replace('{code}', c) : C.msg + ' ' + c;
    location.href = 'https://wa.me/' + line.phone + '?text=' + encodeURIComponent(text);
  };
})();
`;
}
