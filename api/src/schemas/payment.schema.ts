import { z } from "zod";
import { CustomerInfoSchema } from "./customer.schema";
import { SuccessResponseSchema, PaginatedResponseSchema } from "./shared.schema";

// ===== REQUEST SCHEMAS =====
/**
 * Payment creation request
 * Used by POST /payments endpoint
 * Publishes to RabbitMQ for async processing
 */
export const CreatePaymentSchema = z.object({
  amount: z.number().int().positive().describe('Jumlah pembayaran dalam rupiah'),
  customer: CustomerInfoSchema.describe('Informasi customer'),
});

/**
 * Schema parameter path Order ID
 * Digunakan oleh endpoint GET /payments/:orderId
 */
export const OrderIdParamSchema = z.object({
  orderId: z.string().min(1).max(64).describe('ID order yang dapat dibaca (UUID v7)'),
});

// ===== SCHEMA RESPONSE =====
/**
 * Schema status payment yang didukung
 */
export const PaymentStatusEnum = 
z.enum(['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED', 'CANCELLED']).describe('Status payment saat ini');

/**
 * Schema response untuk endpoint GET /payments/:orderId
 * Mengembalikan detail payment lengkap
 */
export const PaymentResponseSchema = z.object({
  id: z.string().uuid().describe('ID unik payment'),
  orderId: z.string().describe('ID order yang dapat dibaca (UUID v7)'),
  amount: z.number().positive().describe('Jumlah pembayaran dalam rupiah'),
  status: PaymentStatusEnum,
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
 * Schema response GET /payments/:orderId
 */
export const GetPaymentResponseSchema = 
SuccessResponseSchema(PaymentResponseSchema);

/**
 * Schema query parameter GET /payments
 * Mendukung pagination dan filter status
 */
export const GetAllPaymentsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().describe('Nomor halaman'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().describe('Jumlah data per halaman'),
  status: PaymentStatusEnum.optional().describe('Filter berdasarkan status'),
});

/**
 * Schema response GET /payments (dengan pagination)
 */
export const GetAllPaymentsResponseSchema = PaginatedResponseSchema(PaymentResponseSchema);
// ===== TIPE TYPESCRIPT =====
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type OrderIdParam = z.infer<typeof OrderIdParamSchema>;
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;
export type GetPaymentResponse = z.infer<typeof GetPaymentResponseSchema>;
export type GetAllPaymentsQuery = z.infer<typeof GetAllPaymentsQuerySchema>;
export type GetAllPaymentsResponse = z.infer<typeof GetAllPaymentsResponseSchema>;