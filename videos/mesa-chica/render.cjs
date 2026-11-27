// Renderiza anim.js cuadro por cuadro con Chromium y arma el MP4 con ffmpeg.
// Uso: node render.js <carpeta de fuentes fontsource> <carpeta de salida> [segundos de muestra separados por coma]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const FONTS = process.argv[2], OUT = process.argv[3], SAMPLES = process.argv[4];
const files = {
  'inter-500': 'fontsource-inter-5.1.1/package/files/inter-latin-500-normal.woff2',
  'inter-600': 'fontsource-inter-5.1.1/package/files/inter-latin-600-normal.woff2',
  'inter-700': 'fontsource-inter-5.1.1/package/files/inter-latin-700-normal.woff2',
  'tight-600': 'fontsource-inter-tight-5.1.1/package/files/inter-tight-latin-600-normal.woff2',
  'tight-700': 'fontsource-inter-tight-5.1.1/package/files/inter-tight-latin-700-normal.woff2',
  'tight-800': 'fontsource-inter-tight-5.1.1/package/files/inter-tight-latin-800-normal.woff2',
  'tight-900': 'fontsource-inter-tight-5.1.1/package/files/inter-tight-latin-900-normal.woff2',
};
const face = (fam, w, k) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(https://fonts.local/${k}.woff2) format('woff2')}`;
const css = [500, 600, 700].map(w => face('Inter', w, 'inter-' + w)).concat([600, 700, 800, 900].map(w => face('Inter Tight', w, 'tight-' + w))).join('\n');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('https://fonts.local/**', r => { const k = r.request().url().split('/').pop().replace('.woff2', ''); r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(path.join(FONTS, files[k])) }); });
  await pg.setContent(`<style>${css}</style><canvas id="c" width="1080" height="1920"></canvas>`);
  await pg.addScriptTag({ path: path.join(__dirname, 'anim.js') });
  await pg.evaluate(async () => { await Promise.all(['900 100px "Inter Tight"', '800 100px "Inter Tight"', '700 100px "Inter Tight"', '600 50px Inter', '700 50px Inter', '500 50px Inter'].map(f => document.fonts.load(f))); });
  const grab = async (t) => pg.evaluate((t) => { const c = document.getElementById('c'), x = c.getContext('2d'); window.ANIM.draw(x, t); return c.toDataURL('image/jpeg', 0.93); }, t);
  if (SAMPLES) {
    for (const s of SAMPLES.split(',')) { const d = await grab(+s); fs.writeFileSync(path.join(OUT, 'muestra-' + s + '.jpg'), Buffer.from(d.split(',')[1], 'base64')); }
  } else {
    const FPS = 30, N = Math.round(30 * FPS), fd = path.join(OUT, 'frames'); fs.mkdirSync(fd, { recursive: true });
    for (let i = 0; i < N; i++) { const d = await grab(i / FPS); fs.writeFileSync(path.join(fd, String(i).padStart(4, '0') + '.jpg'), Buffer.from(d.split(',')[1], 'base64')); }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(fd, '%04d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, 'la-mesa-chica-9x16.mp4')]);
  }
  console.log('listo', errs.length ? 'errores: ' + JSON.stringify(errs) : 'sin errores'); await b.close();
})();
