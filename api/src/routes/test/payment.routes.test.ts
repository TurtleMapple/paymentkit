import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import paymentRoutes from '../payment.routes';
import { errorHandler } from '../../middleware/error.middleware';
import { apiKeyAuth } from '../../middleware/auth.middleware';

// 1. ISOLASI TOTAL (FIRST-U)

vi.mock('../../config/env', () => ({
  env: {
    API_KEY: 'test-secret-key-123'
  }
}));

vi.mock('../../handler/payment.handler', () => {
  return {
    PaymentHandler: class {
      createPayment = vi.fn(async (c) => c.json({ success: true, message: 'Mocked Create SUCCESS' }, 201));
      getAllPayments = vi.fn(async (c) => c.json({ success: true, message: 'Mocked List SUCCESS' }, 200));
      getPaymentByOrderId = vi.fn(async (c) => c.json({ success: true, message: 'Mocked Detail SUCCESS' }, 200));
      cancelPayment = vi.fn(async (c) => c.json({ success: true, message: 'Mocked Cancel SUCCESS' }, 200));
      expirePayment = vi.fn(async (c) => c.json({ success: true, message: 'Mocked Expire SUCCESS' }, 200));
    }
  };
});

describe('Payment Routes (Unit Test - Isolated)', () => {
  const testApp = new OpenAPIHono<{ Variables: { paymentService: any } }>();
  const validKey = 'test-secret-key-123';
  
  testApp.onError(errorHandler);

  testApp.use('*', async (c, next) => {
    c.set('paymentService', {}); 
    await next();
  });

  // Gunakan pola prefix matching yang aman
  testApp.use('/payments/*', apiKeyAuth);
  testApp.route('/payments', paymentRoutes);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /payments', () => {
    it('harus berhasil memproses jika API Key valid (Happy Path)', async () => {
      // Hapus trailing slash untuk kompatibilitas yang lebih baik di test
      const res = await testApp.request('/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': validKey },
        body: JSON.stringify({ 
          amount: 100000, 
          customer: { customerName: 'John', customerEmail: 'john@t.com', phone: '0812' } 
        })
      });

      expect(res.status).toBe(201);
    });

    it('harus mengembalikan 401 jika API Key tidak ada (Negative Path)', async () => {
      const res = await testApp.request('/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100000, customer: { phone: '1' } })
      });

      expect(res.status).toBe(401);
    });

    it('harus mengembalikan 400 jika Zod validation gagal', async () => {
      const res = await testApp.request('/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': validKey },
        body: JSON.stringify({ amount: -500 }) // Sengaja salah
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toBe('Validation failed');
    });
  });

  describe('GET /payments/:orderId', () => {
    it('harus berhasil memetakan rute detail dengan auth', async () => {
      const res = await testApp.request('/payments/ORD-TEST-123', {
        method: 'GET',
        headers: { 'x-api-key': validKey }
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe('Mocked Detail SUCCESS');
    });
  });
  describe('POST /payments/:orderId/cancel', () => {
    it('harus berhasil memetakan rute cancel dengan auth', async () => {
      const res = await testApp.request('/payments/ORD-TEST-123/cancel', {
        method: 'POST',
        headers: { 'x-api-key': validKey }
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe('Mocked Cancel SUCCESS');
    });
  });

  describe('POST /payments/:orderId/expire', () => {
    it('harus berhasil memetakan rute expire dengan auth', async () => {
      const res = await testApp.request('/payments/ORD-TEST-123/expire', {
        method: 'POST',
        headers: { 'x-api-key': validKey }
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe('Mocked Expire SUCCESS');
    });
  });
});
