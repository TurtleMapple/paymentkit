import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookService } from '../webhook.service';
import { PaymentService } from '../payment.service';
import { PaymentGateway } from '../../gateways/IPaymentGateway';
import { PaymentStatus } from '../../entities/paymentStatus';
import { Payment } from '../../entities/paymentEntity';

describe('WebhookService', () => {
  let webhookService: WebhookService;
  let mockPaymentService: PaymentService;
  let mockGateway: PaymentGateway;

  beforeEach(() => {
    mockPaymentService = {
      updatePaymentStatus: vi.fn(),
    } as unknown as PaymentService;

    mockGateway = {
      validateWebhook: vi.fn(),
      processWebhook: vi.fn(),
    } as unknown as PaymentGateway;

    webhookService = new WebhookService(mockPaymentService);
  });

  describe('processWebhook()', () => {
    it('should process webhook successfully (Happy Path)', async () => {
      const payload = { order_id: 'ORD-123', status: 'settlement' };
      const signature = 'valid-sig';
      const webhookResult = { 
        orderId: 'ORD-123', 
        status: PaymentStatus.PAID,
        paymentType: 'bank_transfer'
      };
      // Gunakan Entity Asli untuk mock
      const mockPayment = Payment.create('ORD-123', 10000);
      mockPayment.complete();

      vi.mocked(mockGateway.validateWebhook).mockReturnValue(true);
      vi.mocked(mockGateway.processWebhook).mockResolvedValue(webhookResult as any);
      vi.mocked(mockPaymentService.updatePaymentStatus).mockResolvedValue(mockPayment);

      const result = await webhookService.processWebhook(mockGateway, payload, signature);

      expect(result).toBe(mockPayment);
      expect(mockGateway.validateWebhook).toHaveBeenCalledWith(payload, signature);
      expect(mockPaymentService.updatePaymentStatus).toHaveBeenCalledWith(
        'ORD-123',
        PaymentStatus.PAID,
        expect.objectContaining({ type: 'bank_transfer' })
      );
    });

    it('should throw error if signature is invalid (Sad Path)', async () => {
      vi.mocked(mockGateway.validateWebhook).mockReturnValue(false);

      await expect(webhookService.processWebhook(mockGateway, {}, 'bad-sig'))
        .rejects.toThrow(/Invalid webhook/);
      
      expect(mockPaymentService.updatePaymentStatus).not.toHaveBeenCalled();
    });
  });
});
