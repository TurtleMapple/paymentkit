import { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import { 
  CreatePaymentSchema, 
  PaymentResponseSchema,
  OrderIdParamSchema,
  PaymentActionSchema,
  GetPaymentResponseSchema,
  GetAllPaymentsQuerySchema,
  GetAllPaymentsResponseSchema
} from '../schemas/payment.schema';
import { ErrorResponseSchema } from '../schemas/shared.schema';
import { PaymentHandler } from '../handler/payment.handler';

const payment = new OpenAPIHono<{ Variables: { paymentService: any } }>({
  defaultHook: (result, c) => {
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
  }
});

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
  summary: 'Membuat Pembayaran Baru',
  description: `Endpoint utama untuk memulai proses pembayaran.
  "System Punya Dhika SAPI"
  Sistem akan melakukan:
  1. Validasi input (Order ID, Amount, Gateway).
  2. Menyimpan data pembayaran awal dengan status PENDING ke database.
  3. Mengirimkan pesan (Publish) ke asinkron worker (RabbitMQ) untuk membuat link pembayaran di sisi vendor.
  
  Gunakan endpoint GET /v1/payments/{orderId} setelah ini untuk memantau apakah link pembayaran sudah berhasil dibuat.`,
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
  summary: 'Daftar Semua Pembayaran',
  description: `Mengambil daftar seluruh riwayat pembayaran yang tersimpan di sistem.
  
  Mendukung:
  - **Paginasi**: Gunakan parameter 'page' dan 'limit'.
  - **Filter Status**: Mencari data berdasarkan status tertentu (PAID, PENDING, dll).
  - **Urutan**: Data dikembalikan dengan urutan terbaru ke terlama secara otomatis.`,
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
  summary: 'Detail Pembayaran Berdasarkan Order ID',
  description: `Mengambil informasi lengkap sebuah pembayaran menggunakan Order ID.
  
  Gunakan endpoint ini untuk:
  - Polling status pembayaran dari sisi aplikasi Frontend.
  - Mendapatkan link pembayaran (Snap/Payment Link) setelah worker selesai memproses di background.
  - Melacak status transaksi terakhir (PAID, FAILED, EXPIRED).`,
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
 * POST /payments/:orderId/cancel route definition
 */
const cancelPaymentRoute = createRoute({
  method: 'post',
  path: '/{orderId}/cancel',
  tags: ['Payments'],
  summary: 'Membatalkan Transaksi',
  description: `Membatalkan transaksi yang berstatus PENDING secara manual. 
  
  Aksi ini akan:
  1. Menghubungi API Gateway (Midtrans) untuk membatalkan transaksi/link pembayaran.
  2. Merubah status internal menjadi CANCELLED.`,
  operationId: 'cancelPayment',
  request: {
    params: OrderIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: PaymentActionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetPaymentResponseSchema,
        },
      },
      description: 'Payment cancelled successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Payment cannot be cancelled',
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
 * POST /payments/:orderId/expire route definition
 */
const expirePaymentRoute = createRoute({
  method: 'post',
  path: '/{orderId}/expire',
  tags: ['Payments'],
  summary: 'Menandai Transaksi Kadaluarsa',
  description: `Mensimulasikan atau menandai transaksi sebagai EXPIRED. 
  
  Berguna untuk pengujian atau jika ada pemberitahuan manual bahwa pembayaran tidak dilakukan dalam batas waktu.
  Tetap akan memanggil API Gateway untuk memastikan link pembayaran dideaktivasi.`,
  operationId: 'expirePayment',
  request: {
    params: OrderIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: PaymentActionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetPaymentResponseSchema,
        },
      },
      description: 'Payment expired successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Payment cannot be expired',
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

/**
 * Register POST /payments/:orderId/cancel endpoint
 */
payment.openapi(cancelPaymentRoute, async (c) => {
  const { orderId } = c.req.valid('param');
  const input = c.req.valid('json');
  const service = c.get('paymentService');
  const handler = new PaymentHandler(service);
  return handler.cancelPayment(c, orderId, input) as any;
}, validationHook);

/**
 * Register POST /payments/:orderId/expire endpoint
 */
payment.openapi(expirePaymentRoute, async (c) => {
  const { orderId } = c.req.valid('param');
  const input = c.req.valid('json');
  const service = c.get('paymentService');
  const handler = new PaymentHandler(service);
  return handler.expirePayment(c, orderId, input) as any;
}, validationHook);

export default payment;
