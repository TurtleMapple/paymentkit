import { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import { 
  CreatePaymentSchema, 
  PaymentResponseSchema,
  OrderIdParamSchema,
  GetPaymentResponseSchema,
  GetAllPaymentsQuerySchema,
  GetAllPaymentsResponseSchema
} from '../schemas/payment.schema';
import { ErrorResponseSchema } from '../schemas/shared.schema';
import { PaymentHandler } from '../handler/payment.handler';

const payment = new OpenAPIHono<{ Variables: { paymentService: any } }>();

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

/**
 * Register POST /payments endpoint
 */
payment.openapi(createPaymentRoute, async (c) => {
  const input = c.req.valid('json');
  const service = c.get('paymentService');
  const handler = new PaymentHandler(service);
  return handler.createPayment(c, input) as any;
}, validationHook);

/**
 * Register GET /payments endpoint
 */
payment.openapi(getAllPaymentsRoute, async (c) => {
  const query = c.req.valid('query');
  const service = c.get('paymentService');
  const handler = new PaymentHandler(service);
  return handler.getAllPayments(c, query) as any;
}, validationHook);

/**
 * Register GET /payments/:orderId endpoint
 */
payment.openapi(getPaymentRoute, async (c) => {
  const { orderId } = c.req.valid('param');
  const service = c.get('paymentService');
  const handler = new PaymentHandler(service);
  return handler.getPaymentByOrderId(c, orderId) as any;
}, validationHook);

export default payment;
