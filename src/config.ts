// Configuración leída de variables de entorno. Ver .env.example.
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: req('DATABASE_URL'),
  // URL pública del servidor (para armar el link del script y del webhook).
  publicUrl: (process.env.PUBLIC_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  // 32 bytes en base64: cifra los tokens de Meta y Kommo guardados en la base.
  encryptionKey: req('APP_ENCRYPTION_KEY'),
  // Modelo de Claude para leer comprobantes.
  receiptModel: process.env.RECEIPT_MODEL ?? 'claude-opus-5-5',
  metaApiVersion: process.env.META_API_VERSION ?? 'v21.0',
  // Si la app está publicada con https, las cookies de sesión viajan solo por https.
  cookieSecure: (process.env.PUBLIC_URL ?? '').startsWith('https://'),
  // Crea el primer superadministrador al arrancar, si todavía no existe ninguno.
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
};
