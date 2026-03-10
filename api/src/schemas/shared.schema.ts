import { z, ZodType } from 'zod';

/**
 * SHARED ZOD SCHEMAS
 *
 * Schema umum yang digunakan di seluruh API untuk validasi request/response
 * dan generasi dokumentasi OpenAPI.
 */

/**
 * Schema response error
 * Digunakan ketika request gagal validasi atau terjadi error
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false).describe('Status keberhasilan (selalu false untuk error)'),
  error: z.string().describe('Jenis error'),
  details: z.any().optional().describe('Detail error tambahan')
});

/**
 * Factory untuk schema response sukses
 * Membungkus response sukses dengan format standar
 * @param dataSchema - Zod schema untuk data response
 */
export const SuccessResponseSchema = <T>(dataSchema: ZodType<T>) =>
  z.object({
    success: z.literal(true).describe('Status keberhasilan (selalu true untuk sukses)'),
    data: dataSchema.describe('Data response'),
    message: z.string().describe('Pesan sukses')
  });

/**
 * Schema untuk data customer
 */
export const CustomerSchema = z.object({
  customerName: z.string().min(1).max(128).optional().describe('Nama customer'),
  customerEmail: z.string().email().max(128).optional().describe('Email customer'),
});

/**
 * Schema entity Payment
 * Merepresentasikan struktur lengkap payment yang dikembalikan API
 * Sesuai dengan Payment entity dari src/domain/entities/paymentEntity.ts
 */
export const PaymentSchema = z.object({
  id: z.string().uuid().describe('ID unik payment'),
  orderId: z.string().describe('Order ID yang dapat dibaca (UUID v7)'),
  amount: z.number().positive().describe('Jumlah pembayaran dalam rupiah'),
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'EXPIRED']).describe('Status payment saat ini'),
  paymentType: z.string().nullable().optional().describe('Jenis metode pembayaran'),
  bank: z.string().nullable().optional().describe('Kode bank untuk transfer bank'),
  vaNumber: z.string().nullable().optional().describe('Nomor virtual account'),
  expiredAt: z.coerce.date().nullable().optional().describe('Waktu kadaluarsa pembayaran'),
  paidAt: z.coerce.date().nullable().optional().describe('Waktu pembayaran selesai'),
  gateway: z.string().describe('Payment gateway yang digunakan (midtrans, xendit)'),
  gatewayResponse: z.any().nullable().optional().describe('Response mentah dari payment gateway'),
  createdAt: z.coerce.date().describe('Waktu payment dibuat'),
  updatedAt: z.coerce.date().describe('Waktu update terakhir'),
  deletedAt: z.coerce.date().nullable().optional().describe('Waktu soft delete'),
  paymentLink: z.string().nullable().optional().describe('URL payment link untuk customer'),
  paymentLinkCreatedAt: z.coerce.date().nullable().optional().describe('Waktu payment link dibuat'),
  paymentAttemptCount: z.number().int().min(0).describe('Jumlah percobaan generate payment link'),
  customerName: z.string().nullable().optional().describe('Nama customer'),
  customerEmail: z.string().nullable().optional().describe('Email customer'),
});

/**
 * Ekspor tipe TypeScript
 */
export type Payment = z.infer<typeof PaymentSchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type SuccessResponse<T> = {
  success: true;
  data: T;
  message: string;
};
