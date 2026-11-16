// Configuración leída de variables de entorno. Ver .env.example.
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

// Dirección pública: PUBLIC_URL si está cargada; si no, la que asigna el hosting (Render o Railway).
const publicUrl = (
  process.env.PUBLIC_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '') ||
  'http://localhost:3000'
).replace(/\/$/, '');

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: req('DATABASE_URL'),
  // URL pública del servidor (para armar el link del script y del webhook).
  publicUrl,
  // Cifra los tokens de Meta y Kommo guardados en la base (Render la genera sola).
  encryptionKey: req('APP_ENCRYPTION_KEY'),
  // Modelo de Claude para leer comprobantes.
  receiptModel: process.env.RECEIPT_MODEL ?? 'claude-opus-5-5',
  metaApiVersion: process.env.META_API_VERSION ?? 'v21.0',
  // Si la app está publicada con https, las cookies de sesión viajan solo por https.
  cookieSecure: publicUrl.startsWith('https://'),
  // Crea el primer superadministrador al arrancar, si todavía no existe ninguno.
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
};
