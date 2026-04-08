import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import webhookRoutes from '../webhook.routes';
import { errorHandler } from '../../middleware/error.middleware';
import { apiKeyAuth } from '../../middleware/auth.middleware';

// 1. ISOLASI TOTAL (FIRST-U)

// Mock Environment agar apiKeyAuth bisa bekerja dengan nilai statis
vi.mock('../../config/env', () => ({
  env: {
    API_KEY: 'test-secret-key-123'
  }
}));

// Mock WebhookHandler secara total 
vi.mock('../../handler/webhook.handler', () => {
  return {
    WebhookHandler: class {
      handleWebhook = vi.fn(async (c) => c.json({ success: true, message: 'Mocked Webhook SUCCESS' }, 200));
    }
  };
});

describe('Webhook Routes (Unit Test - Isolated)', () => {
  const testApp = new OpenAPIHono<{ Variables: { webhookService: any } }>();
  const validKey = 'test-secret-key-123';
  
  testApp.onError(errorHandler);

  // Injeksi Mock Service melalui context
  testApp.use('*', async (c, next) => {
    c.set('webhookService', {}); // Dummy service
    await next();
  });

  // Tambahkan Auth Middleware (Sesuai Standar: Cek Otorisasi)
  testApp.use('/webhooks/*', apiKeyAuth);

  // Pasang rute ke aplikasi testing (Mounted at /webhooks)
  testApp.route('/webhooks', webhookRoutes);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /webhooks/:gateway', () => {
    it('harus berhasil memproses webhook dengan gateway valid (Happy Path)', async () => {
      const res = await testApp.request('/webhooks/midtrans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': validKey },
        body: JSON.stringify({ 
          order_id: 'ORD-123', 
          transaction_status: 'settlement' 
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe('Mocked Webhook SUCCESS');
    });

    it('harus mengembalikan 401 jika API Key tidak ada (Negative Path)', async () => {
      const res = await testApp.request('/webhooks/midtrans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'ORD-123' })
      });

      expect(res.status).toBe(401);
    });

    it('harus mengembalikan 400 jika mengakses gateway yang tidak didukung (Enum Validation)', async () => {
      // 'unsupported' tidak terdaftar di gateway enum kita ['midtrans', 'xendit']
      const res = await testApp.request('/webhooks/unsupported', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': validKey },
        body: JSON.stringify({ orderId: 'ORD-123' })
      });

      expect(res.status).toBe(400); 
      const body = await res.json();
      expect(body.message).toBe('Validation failed');
    });
  });
});
