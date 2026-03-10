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
  payment: z.any().optional().describe('Detail pembayaran yang diperbarui (jika tersedia)'),
  processedAt: z.string().optional().describe('Waktu pemrosesan (jika tersedia)')
});

/**
 * Schema parameter gateway webhook
 * Digunakan untuk endpoint POST /webhooks/:gateway
 */
export const WebhookGatewayParamSchema = z.object({
  gateway: z.enum(['midtrans']).describe('Nama payment gateway')
});

/**
 * Schema webhook khusus Midtrans (untuk validasi internal)
 */
export const MidtransWebhookSchema = z.object({
  transaction_id: z.string().describe('ID transaksi dari Midtrans'),
  order_id: z.string().describe('ID order dari sistem'),
  gross_amount: z.string().describe('Total pembayaran'),
  payment_type: z.string().describe('Jenis pembayaran (bank_transfer, gopay, dll)'),
  transaction_time: z.string().describe('Waktu transaksi'),
  transaction_status: z.string().describe('Status transaksi (settlement, pending, dll)'),
  fraud_status: z.string().optional().describe('Status fraud detection'),
  status_code: z.string().describe('Kode status HTTP'),
  signature_key: z.string().describe('Signature untuk validasi keamanan'),
  va_numbers: z.array(z.object({
    bank: z.string().describe('Nama bank'),
    va_number: z.string().describe('Nomor virtual account'),
  })).optional().describe('Nomor virtual account (untuk bank transfer)'),
  expiry_time: z.string().optional().describe('Waktu kadaluarsa pembayaran'),
  settlement_time: z.string().optional().describe('Waktu settlement'),
});

/**
 * Ekspor tipe TypeScript
 */
export type WebhookRequest = z.infer<typeof WebhookRequestSchema>;
export type WebhookResponse = z.infer<typeof WebhookResponseSchema>;
export type WebhookGatewayParam = z.infer<typeof WebhookGatewayParamSchema>;
export type MidtransWebhook = z.infer<typeof MidtransWebhookSchema>;