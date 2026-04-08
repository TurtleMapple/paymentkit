import { z } from 'zod';

/**
 * WEBHOOK ZOD SCHEMAS
 * 
 * Schema yang tidak terikat pada gateway tertentu untuk endpoint webhook
 * Mendukung berbagai payment gateway (Midtrans, Xendit, dll.)
 */

/**
 * Schema request webhook
 * Menerima struktur payload apapun dari gateway
 * Validasi didelegasikan ke implementasi gateway masing-masing
 */
export const WebhookRequestSchema = z.object({}).passthrough().describe('Payload webhook dari payment gateway');

/**
 * Schema response webhook
 * Response standar setelah memproses webhook
 */
export const WebhookResponseSchema = z.object({
  success: z.boolean().describe('Status keberhasilan pemrosesan webhook'),
  message: z.string().describe('Pesan hasil pemrosesan'),
  invoice: z.any().optional().describe('Detail pembayaran yang diperbarui (jika tersedia)'),
  processedAt: z.string().optional().describe('Waktu pemrosesan (jika tersedia)')
});

/**
 * Schema parameter gateway webhook
 * Digunakan untuk endpoint POST /webhooks/:gateway
 */
export const WebhookGatewayParamSchema = z.object({
  gateway: z.enum(['midtrans', 'xendit']).describe('Payment Gateway (midtrans, xendit)')
});

/**
 * Ekspor tipe TypeScript
 */
export type WebhookRequest = z.infer<typeof WebhookRequestSchema>;
export type WebhookResponse = z.infer<typeof WebhookResponseSchema>;
export type WebhookGatewayParam = z.infer<typeof WebhookGatewayParamSchema>;