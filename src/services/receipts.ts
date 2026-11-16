import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';

export const ReceiptSchema = z.object({
  is_payment_receipt: z.boolean(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  date: z.string().nullable(),
  bank_or_wallet: z.string().nullable(),
  operation_id: z.string().nullable(),
  payer_name: z.string().nullable(),
  recipient_name: z.string().nullable(),
  recipient_account: z.string().nullable(),
  confidence: z.number(),
  notes: z.string(),
});
export type ReceiptReading = z.infer<typeof ReceiptSchema>;

/** Devuelve la lectura, o null si el modelo no pudo o no quiso leer la imagen (va a revisión manual). */
export type ReceiptAnalyzer = (image: Buffer, mediaType: SupportedMediaType) => Promise<ReceiptReading | null>;

export const SUPPORTED_MEDIA = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export type SupportedMediaType = (typeof SUPPORTED_MEDIA)[number];

export function detectMediaType(buf: Buffer, hint?: string | null): SupportedMediaType | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 6 && buf.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  const h = (hint ?? '').toLowerCase().split(';')[0].trim();
  return (SUPPORTED_MEDIA as readonly string[]).includes(h) ? (h as SupportedMediaType) : null;
}

const SYSTEM_PROMPT = `Sos el lector de comprobantes de pago de un sistema de ventas. Los negocios que lo usan venden por WhatsApp en Argentina y Latinoamérica, y sus clientes les mandan una captura o foto del pago.

Para cada imagen decidí si es un comprobante de pago real (transferencia bancaria, Mercado Pago, Ualá, Brubank, Naranja X, cuenta DNI, billeteras, depósitos, pagos con QR, recibos de pago) y extraé sus datos.

Reglas:
- is_payment_receipt es false si la imagen es otra cosa: fotos de productos, capturas de chats, publicidades, documentos de identidad, pantallas de saldo sin una operación concreta, o un comprobante de una operación que no es un pago hacia otra persona o comercio.
- No inventes datos. Si un campo no se lee con claridad en la imagen, devolvé null.
- amount es el monto transferido o pagado, como número con punto decimal. En Argentina "$ 25.000,50" es 25000.5. No uses el saldo disponible ni montos de comisiones.
- currency: código ISO (ARS, USD, UYU, CLP, MXN, etc.). Si solo figura "$" y el comprobante es argentino, es ARS.
- date: la fecha y hora de la operación tal como aparece, en formato AAAA-MM-DD HH:MM si se puede.
- operation_id: el número de operación, transacción, comprobante, referencia, ID o código de la operación. Copialo exacto.
- payer_name / recipient_name: quien envía y quien recibe. recipient_account: el CBU, CVU, alias o número de cuenta del destinatario si aparece.
- confidence entre 0 y 1: qué tan seguro estás de que es un comprobante real y de que el monto es correcto. Bajala si la imagen está cortada, borrosa, tiene montos que no coinciden entre sí, tipografías mezcladas, recortes o cualquier señal de edición.
- notes: una oración en español con lo que un humano tendría que revisar, o "Sin observaciones".`;

export function claudeReceiptAnalyzer(model: string, client = new Anthropic()): ReceiptAnalyzer {
  return async (image, mediaType) => {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 4000,
      // Si el modelo declina la imagen, el servidor reintenta con un modelo de respaldo.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(ReceiptSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image.toString('base64') } },
            { type: 'text', text: 'Leé esta imagen y devolvé los datos del comprobante.' },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null;
    return response.parsed_output ?? null;
  };
}
