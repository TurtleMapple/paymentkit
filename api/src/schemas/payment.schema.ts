/**
 * PAYMENT ZOD SCHEMAS
 * 
 * Request/response schemas for payment endpoints
 * Used for validation and OpenAPI documentation generation
 */

import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

// ===== BASE SCHEMAS (Reusable) =====

/**
 * Customer information schema
 * Reusable across multiple payment-related endpoints
 */
export const CustomerSchema = z.object({
  customerName: z.string().min(1).max(128),
  customerEmail: z.string().email().max(128),
});

// ===== REQUEST SCHEMAS =====

/**
 * Payment creation request
 * Used by POST /payments endpoint
 * Publishes to RabbitMQ for async processing
 */
export const CreatePaymentSchema = z.object({
  amount: z.number().int().positive(),
  customer: CustomerSchema,
});

/**
 * Order ID path parameter
 * Used by GET /payments/:orderId endpoint
 */
export const OrderIdParamSchema = z.object({
  orderId: z.string().min(1).max(64),
});

// ===== RESPONSE SCHEMAS =====

/**
 * Payment response structure
 * Contains all payment details including status and payment link
 */
export const PaymentResponseSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string(),
  amount: z.number(),
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'EXPIRED']),
  paymentType: z.string().nullable(),
  bank: z.string().nullable(),
  vaNumber: z.string().nullable(),
  paymentLink: z.string().nullable(),
  expiredAt: z.string().nullable(),
  paidAt: z.string().nullable(),
  gateway: z.string(),
  customerName: z.string().nullable(),
  customerEmail: z.string().nullable(),
  
  // Field tambahan dari Midtrans
  paymentLinkId: z.string().nullable(),
  usageLimit: z.number().nullable(),
  paymentAttemptCount: z.number(),
  
  // Direct link Midtrans untuk redirect
  midtransDirectUrl: z.string().nullable(),    // TAMBAH INI
  
  createdAt: z.string(),
  updatedAt: z.string(),
});



/**
 * Generic success response wrapper
 * Reusable for all successful GET responses
 */
export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

/**
 * GET payment response with wrapper
 * Used by GET /payments/:orderId endpoint
 */
export const GetPaymentResponseSchema = SuccessResponseSchema(PaymentResponseSchema);

/**
 * Error response structure
 * Used for 404 and other error responses
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
});

/**
 * Query parameters for GET /payments
 * Validates pagination and filter parameters
 */
export const GetAllPaymentsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'EXPIRED']).optional(),
});

/**
 * Pagination metadata structure
 * Contains page, limit, and total count
 */
export const PaginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
});

/**
 * GET all payments response with pagination
 * Used by GET /payments endpoint
 */
export const GetAllPaymentsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(PaymentResponseSchema),
  pagination: PaginationSchema,
});

// ===== WEBHOOK SCHEMAS =====

/**
 * Midtrans webhook notification payload
 * Used by POST /webhook endpoint
 * Receives payment status updates from Midtrans
 */
export const MidtransWebhookSchema = z.object({
  order_id: z.string(),
  transaction_status: z.string(),
  payment_type: z.string(),
  gross_amount: z.string(),
  signature_key: z.string(),
  transaction_time: z.string().optional(),
  fraud_status: z.string().optional(),
  va_numbers: z.array(z.object({
    bank: z.string(),
    va_number: z.string(),
  })).optional(),
});

// ===== TYPES =====
export type CustomerInfo = z.infer<typeof CustomerSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type OrderIdParam = z.infer<typeof OrderIdParamSchema>;
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;
export type GetPaymentResponse = z.infer<typeof GetPaymentResponseSchema>;
export type GetAllPaymentsQuery = z.infer<typeof GetAllPaymentsQuerySchema>;
export type GetAllPaymentsResponse = z.infer<typeof GetAllPaymentsResponseSchema>;
export type MidtransWebhook = z.infer<typeof MidtransWebhookSchema>;