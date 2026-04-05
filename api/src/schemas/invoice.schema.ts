import { z } from "zod";
import { CustomerInfoSchema } from "./customer.schema";

/**
 * Schema request pembuatan invoice baru
 * Digunakan oleh endpoint POST /payments (atau nantinya POST /invoices)
 */
export const CreateInvoiceRequestSchema = z.object({
  amount: z.number().int().positive().describe('Jumlah pembayaran dalam rupiah'),
  gateway: z.string().default('midtrans').describe('Payment gateway yang digunakan'),
  customer: CustomerInfoSchema.describe('Informasi customer'),
});

/**
 * Schema response invoice
 * Struktur data invoice yang dikembalikan API setelah pembuatan
 */
export const InvoiceResponseSchema = z.object({
  id: z.string().uuid().describe('ID unik invoice'),
  orderId: z.string().describe('Order ID (UUID v7)'),
  amount: z.number().describe('Jumlah pembayaran dalam rupiah'),
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'EXPIRED']).describe('Status invoice saat ini'),
  gateway: z.string().describe('Payment gateway yang digunakan'),
  paymentLink: z.string().nullable().describe('URL payment link untuk customer'),
  expiredAt: z.string().nullable().describe('Waktu kadaluarsa invoice'),
  customerName: z.string().nullable().describe('Nama customer'),
  customerEmail: z.string().nullable().describe('Email customer'),
  createdAt: z.string().describe('Waktu invoice dibuat'),
});

// ===== TIPE TYPESCRIPT =====
export type CreateInvoiceRequest = z.infer<typeof CreateInvoiceRequestSchema>;
export type InvoiceResponse = z.infer<typeof InvoiceResponseSchema>;