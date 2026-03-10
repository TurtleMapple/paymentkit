import { Context } from "hono";
import { CreatePaymentInput, GetAllPaymentsQuery } from "../schemas/payment.schema";
import { mapPaymentToResponse } from "../utils/formatters/payment-response.formatter";
import { PaymentStatus } from "../domain/entities/paymentStatus";
import { v7 as uuidv7 } from 'uuid';

// ===== CONSTANTS (OCP: Centralized configuration) =====
const PAYMENT_GATEWAY = 'midtrans';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

// ===== HELPER FUNCTIONS (SRP: Separate response formatting) =====

/**
 * Creates success response with wrapper
 */
function createSuccessResponse(data: any) {
  return {
    success: true as const,
    data,
  };
}

/**
 * Creates success response with pagination
 */
function createPaginatedResponse(data: any[], page: number, limit: number, total: number) {
  return {
    success: true as const,
    data,
    pagination: {
      page,
      limit,
      total,
    },
  };
}

/**
 * Creates error response
 */
function createErrorResponse(message: string) {
  return {
    error: message,
  };
}

// ===== HANDLERS =====

/**
 * POST /payments handler
 * Creates payment and publishes to RabbitMQ for async processing
 * 
 * @param c - Hono context
 * @param input - Validated payment input
 */
export async function createPaymentHandler(
  c: Context,
  input: CreatePaymentInput
) {
  const service = c.get('paymentService');

  try {
    // Auto-generate orderId using UUID v7
    const orderId = uuidv7();

    // Create payment in DB and publish to RabbitMQ
    const payment = await service.createPayment(
      orderId,
      input.amount,
      PAYMENT_GATEWAY,
      input.customer.customerName,
      input.customer.customerEmail
    );

    // Worker will process message and call Midtrans
    // Return immediately with PENDING status

    return c.json(mapPaymentToResponse(payment), 201);
  } catch (error: any) {
    if (error.message === 'Order ID already exists') {
      return c.json(createErrorResponse(error.message), 409);
    }
    throw error;
  }
}

/**
 * GET /payments/:orderId handler
 * Retrieves payment details by order ID (polling endpoint)
 * 
 * @param c - Hono context
 * @param orderId - Order ID from path parameter
 */
export async function getPaymentByOrderIdHandler(
  c: Context,
  orderId: string
) {
  const service = c.get('paymentService');

  const payment = await service.getPaymentByOrderId(orderId);

  if (!payment) {
    return c.json(createErrorResponse('Payment not found'), 404);
  }

  return c.json(createSuccessResponse(mapPaymentToResponse(payment)), 200);
}

/**
 * GET /payments handler
 * Retrieves all payments with pagination and optional filtering
 * 
 * @param c - Hono context
 * @param query - Validated query parameters
 */
export async function getAllPaymentsHandler(
  c: Context,
  query: GetAllPaymentsQuery
) {
  const service = c.get('paymentService');

  const page = query.page || DEFAULT_PAGE;
  const limit = query.limit || DEFAULT_LIMIT;

  const { data, total } = await service.getAllPayments({
    page,
    limit,
    status: query.status as PaymentStatus | undefined,
  });

  const mappedData = data.map(mapPaymentToResponse);

  return c.json(
    createPaginatedResponse(mappedData, page, limit, total),
    200
  );
}
