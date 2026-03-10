/**
 * PAYMENT ROUTES
 * 
 * Defines payment-related API endpoints with OpenAPI specifications
 * Following SOLID principles for better maintainability and testability
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import { 
  CreatePaymentSchema, 
  PaymentResponseSchema,
  OrderIdParamSchema,
  GetPaymentResponseSchema,
  ErrorResponseSchema,
  GetAllPaymentsQuerySchema,
  GetAllPaymentsResponseSchema
} from '../schemas/payment.schema';
import { createPaymentHandler, getAllPaymentsHandler, getPaymentByOrderIdHandler } from '../handler/payment.handler';

const payment = new OpenAPIHono();

// Custom validation error hook
const validationHook = (result: any, c: any) => {
  if (!result.success) {
    return c.json({
      success: false,
      message: 'Validation failed',
      errors: result.error.issues.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message
      }))
    }, 400);
  }
};

// ===== ROUTE DEFINITIONS (SRP: Separate route config from handler logic) =====

/**
 * POST /payments route definition
 * Creates a new payment and publishes to RabbitMQ for async processing
 */
const createPaymentRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Payments'],
  summary: 'Create Payment',
  description: 'Creates a new payment and publishes to RabbitMQ for async processing',
  operationId: 'createPayment',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePaymentSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: PaymentResponseSchema,
        },
      },
      description: 'Payment created successfully',
    },
    409: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Order ID already exists',
    },
  },
});

/**
 * GET /payments route definition
 * Retrieves all payments with pagination and optional filtering
 */
const getAllPaymentsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Payments'],
  summary: 'Get All Payments',
  description: 'Retrieves all payments with pagination and optional filtering',
  operationId: 'getAllPayments',
  request: {
    query: GetAllPaymentsQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetAllPaymentsResponseSchema,
        },
      },
      description: 'Payments retrieved successfully',
    },
  },
});

/**
 * GET /payments/:orderId route definition
 * Retrieves payment details by order ID (polling endpoint)
 */
const getPaymentRoute = createRoute({
  method: 'get',
  path: '/{orderId}',
  tags: ['Payments'],
  summary: 'Get Payment by Order ID',
  description: 'Retrieves payment details by order ID (polling endpoint)',
  operationId: 'getPaymentByOrderId',
  request: {
    params: OrderIdParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetPaymentResponseSchema,
        },
      },
      description: 'Payment found',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Payment not found',
    },
  },
});

// ===== ROUTE REGISTRATION (SRP: Separate registration logic) =====

/**
 * Register POST /payments endpoint
 */
payment.openapi(createPaymentRoute, async (c) => {
  const input = c.req.valid('json');
  return createPaymentHandler(c, input);
}, validationHook);

/**
 * Register GET /payments endpoint
 */
payment.openapi(getAllPaymentsRoute, async (c) => {
  const query = c.req.valid('query');
  return getAllPaymentsHandler(c, query);
}, validationHook);

/**
 * Register GET /payments/:orderId endpoint
 */
payment.openapi(getPaymentRoute, async (c) => {
  const { orderId } = c.req.valid('param');
  return getPaymentByOrderIdHandler(c, orderId);
}, validationHook);

export default payment;
