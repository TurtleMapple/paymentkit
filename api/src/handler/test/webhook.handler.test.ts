import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookHandler } from '../webhook.handler';
import { HttpStatus } from '../../utils/http-status.util';
import { Payment } from '../../domain/entities/paymentEntity';

const mockWebhookService = {
  processWebhook: vi.fn(),
};

const mockContext = {
  req: {
    header: vi.fn(),
  },
  json: vi.fn((data, status: any) => ({ type: 'json', data, status })),
} as any;

describe('Webhook Handler - Unit & Gray Box Testing', () => {
  let handler: WebhookHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new WebhookHandler(mockWebhookService);
  });

  describe('handleWebhook Endpoint', () => {
    describe('Red Flag Testing (Skenario Gagal / Exceptions)', () => {
      it('harus memblokir dan melempar *throw Exception* secara *fail-fast* jika signature header tidak ditemukan', async () => {
        mockContext.req.header.mockReturnValue(null);

        await expect(handler.handleWebhook(mockContext, { gateway: 'midtrans' }, {}))
          .rejects.toThrow('Signature tidak ditemukan di header maupun di body payload');
      });
    });

    describe('Green Flag Testing (Skenario Berhasil)', () => {
      it('harus berhasil memproses webhook dan mengembalikan detail order ID serta status terbaru', async () => {
        // [Stub] Mock Signature
        mockContext.req.header.mockReturnValue('valid-signature-123');

        // [Stub] Mock Result dari Service menggunakan Entity Asli
        const fakePayment = Payment.create('ORD-777', 150000);
        fakePayment.complete();
        mockWebhookService.processWebhook.mockResolvedValue(fakePayment);

        const mockBody = { some: 'payload' };
        await handler.handleWebhook(mockContext, { gateway: 'midtrans' }, mockBody);

        expect(mockWebhookService.processWebhook).toHaveBeenCalledWith(
          expect.any(Object),
          mockBody,
          'valid-signature-123'
        );

        expect(mockContext.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: {
              orderId: 'ORD-777',
              status: 'PAID'
            }
          }),
          HttpStatus.OK
        );
      });
    });
  });
});
