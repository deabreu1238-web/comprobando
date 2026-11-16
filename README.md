# Comprobado

Sistema para negocios que venden desde anuncios de Meta y cobran por comprobante (transferencias, Mercado Pago, billeteras). Mide cada venta hasta el anuncio que la generó y se la informa a Meta, para que las campañas optimicen por ventas reales y no por mensajes.

**Cómo funciona:**

1. **Landing:** el botón llama a `openRandomLink()`. El script genera un código de 8 caracteres, guarda el clic del anuncio (`fbclid`, `_fbc`, `_fbp`, UTM) y abre WhatsApp en uno de los números de la cuenta, repartidos según su peso, con el mensaje "Hola! mi código es A1B2C3D4".
2. **Chat:** el primer mensaje del cliente trae el código. Por el webhook de Kommo, el sistema lo detecta y vincula la conversación con el clic original.
3. **Comprobante:** cuando el cliente manda la foto del pago, Claude la lee: si es un comprobante válido, monto, moneda, banco, número de operación, emisor, destinatario y nivel de confianza.
4. **Venta:** se registra la venta. Hay dos modos:
   - **Manual:** alguien del negocio la aprueba en el portal.
   - **Automático:** se aprueba sola si la confianza es alta, el destinatario es el negocio y el chat tiene código.
5. **Meta:** se envía el evento `Purchase` a la API de conversiones, con el monto, el `fbc` del clic original, el teléfono cifrado y un ID de deduplicación.

También detecta ventas por **etapa de Kommo**: un negocio movido a "Ganado", "Compró", etc. Si el mismo cliente dispara las dos vías, se registra una sola venta.

**Protecciones incluidas:**
- Un comprobante con el mismo número de operación no suma dos ventas.
- El mismo aviso de Kommo repetido no se procesa dos veces.
- Los comprobantes de pagos hechos a otra persona van a revisión.
- Los comprobantes dudosos (confianza baja, señales de edición) van a revisión, con el motivo.
- Los tokens de Meta y Kommo se guardan cifrados.
- Cada cuenta ve solo sus datos.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/landing/tracker.ts` | Script de la landing (`/t/CLAVE.js`) |
| `src/routes/public.ts` | Script y registro de clics |
| `src/routes/kommo.ts` | Webhook de Kommo |
| `src/routes/api.ts` | API del portal y de administración |
| `src/services/receipts.ts` | Lectura de comprobantes con Claude |
| `src/services/engine.ts` | Vinculación, ventas, deduplicación y aprobación |
| `src/services/capi.ts` | Envío a la API de conversiones de Meta |
| `src/services/kommo.ts` | Lectura de webhooks y API de Kommo |
| `public/` | Portal web (sin dependencias) |
| `migrations/` | Esquema de la base de datos |
| `tests/` | Prueba de punta a punta |

## Instalación en producción (Railway + Supabase)

1. **Base de datos:** creá un proyecto en Supabase y copiá la cadena de conexión en Project Settings → Database → Connection string (URI).
2. **Servidor:** en Railway, creá un servicio desde este repositorio de GitHub.
   - Build: `npm ci && npm run build`
   - Start: `npm start`
3. **Variables de entorno:** cargalas en Railway (ver `.env.example`):
   - `DATABASE_URL`: la cadena de Supabase
   - `PUBLIC_URL`: la dirección pública que te da Railway (o tu dominio)
   - `APP_ENCRYPTION_KEY`: un texto aleatorio de 32 caracteres o más (una contraseña generada sirve). Guardala aparte: si la perdés, hay que volver a cargar los tokens de todas las cuentas.
   - `ADMIN_EMAIL` y `ADMIN_PASSWORD`: tu usuario administrador, que se crea en el primer arranque. Después borrá `ADMIN_PASSWORD`.
   - No definas `NODE_ENV=production` en la compilación: deja afuera TypeScript y falla el build.
   - `ANTHROPIC_API_KEY`: tu clave de la API de Anthropic
4. **Primer arranque:** el servidor crea las tablas y tu usuario administrador.
5. Entrá a `PUBLIC_URL` con ese usuario y creá las cuentas de tus clientes en **Cuentas (admin)**.

## Alta de un cliente

Cada negocio entra al portal con su usuario y completa:

1. **Números de WhatsApp:** los números que van a rotar, con código de país (ej. `5491155555555`).
2. **Integraciones → Tu landing:** copia el código y lo pega en su landing.
3. **Integraciones → Meta:**
   - Identificador del píxel y token de la API de conversiones (Administrador de eventos → píxel → Configuración).
   - Para la primera prueba conviene cargar el código de prueba y borrarlo cuando los eventos aparezcan bien.
4. **Integraciones → Kommo** (opcional):
   - Dirección de su Kommo y token de larga duración (Configuración → Integraciones → API).
   - Pegar en Kommo la URL de webhook que muestra el portal, con los eventos **"Nuevo mensaje entrante"** y **"Modificación de etapa del negocio"**.
5. **Ajustes:**
   - Sus datos de cobro (nombre, alias, CBU) para frenar comprobantes de pagos a otra persona.
   - El modo de aprobación. Recomendado: **manual** al principio.
6. **En sus anuncios**, en "Parámetros de URL": `utm_source=meta&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`

Si el negocio todavía no usa Kommo, puede subir los comprobantes a mano en **Cargar comprobante**, indicando el código del chat.

## Desarrollo

```bash
npm install
cp .env.example .env   # completá DATABASE_URL, APP_ENCRYPTION_KEY y ANTHROPIC_API_KEY
npm run dev
```

Pruebas, contra un Postgres local (no llaman a Meta, a Kommo ni a Claude):

```bash
TEST_DATABASE_URL=postgres://usuario:clave@localhost:5432/comprobado_test npm test
```

`dev/demo-server.ts` levanta un portal de demostración con datos de ejemplo en `http://127.0.0.1:3999` (usuario `demo@comprobado.app`, clave `demo-demo-123`). **Borra la base que le indiques.**

## Costos de la IA

Cada comprobante es una llamada a Claude con una imagen. Con el modelo por defecto (`claude-opus-5-5`) el costo estimado ronda los 2 centavos de dólar por imagen, según su tamaño. Es una estimación: medilo con tus comprobantes reales en la consola de Anthropic. El modelo se cambia con `RECEIPT_MODEL`.

## Pendiente para próximas versiones

- **Validar el webhook de Kommo con una cuenta real.** El formato de los mensajes y adjuntos está armado según la documentación y con lectura tolerante, pero hay que confirmarlo con avisos reales. El portal muestra los últimos avisos recibidos, y la tabla `webhook_events` guarda cada uno completo.
- **Conexión de WhatsApp por QR**, sin Kommo.
- **Cobro de la suscripción** (por ejemplo con Mercado Pago), recuperación de contraseña e invitación de más usuarios por cuenta.
- **Reintentos automáticos** de los envíos a Meta que fallen. Hoy se reintentan a mano desde el portal.
