import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '../payment.service';
import { PaymentStatus } from '../../entities/paymentStatus';
import { IPaymentRepository } from '../../repositories/IPaymentRepository';
import { IPaymentEventPublisher } from '../IPaymentEventPublisher';
import { Payment } from '../../entities/paymentEntity';

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockRepo: IPaymentRepository;
  let mockPublisher: IPaymentEventPublisher;

  beforeEach(() => {
    mockRepo = {
      findByOrderId: vi.fn(),
      save: vi.fn(),
      findAllWithCount: vi.fn(),
    } as unknown as IPaymentRepository;

    mockPublisher = {
      publishPaymentCreated: vi.fn(),
      publishPaymentUpdated: vi.fn(),
    } as unknown as IPaymentEventPublisher;

    paymentService = new PaymentService(mockRepo, mockPublisher);
  });

  describe('createPayment()', () => {
    it('harus berhasil membuat pembayaran (Happy Path)', async () => {
      const orderId = 'ORD-123';
      const mockPayment = Payment.create(orderId, 10000);

      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(null);
      vi.mocked(mockRepo.save).mockResolvedValue(undefined);

      const result = await paymentService.createPayment(orderId, 10000, 'midtrans');

      expect(result.orderId).toBe(orderId);
      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockPublisher.publishPaymentCreated).toHaveBeenCalledWith(orderId);
    });

    it('harus melempar error jika Order ID sudah ada (Sad Path)', async () => {
      const orderId = 'ORD-123';
      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(Payment.create(orderId, 10000));

      await expect(paymentService.createPayment(orderId, 10000, 'midtrans'))
        .rejects.toThrow('Order ID already exists');
      
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('updatePaymentStatus()', () => {
    it('harus berhasil memperbarui status (Happy Path)', async () => {
      const orderId = 'ORD-123';
      const existingPayment = Payment.create(orderId, 10000);

      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(existingPayment);
      vi.mocked(mockRepo.save).mockResolvedValue(undefined);

      const result = await paymentService.updatePaymentStatus(orderId, PaymentStatus.PAID);

      expect(result.getStatus()).toBe(PaymentStatus.PAID);
      expect(mockRepo.save).toHaveBeenCalledWith(existingPayment);
      expect(mockPublisher.publishPaymentUpdated).toHaveBeenCalledWith(orderId, PaymentStatus.PAID);
    });

    it('harus melempar error jika transisi status tidak valid (Sad Path)', async () => {
      const orderId = 'ORD-123';
      const existingPayment = Payment.create(orderId, 10000);
      existingPayment.complete(); // Status: PAID

      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(existingPayment);

      await expect(paymentService.updatePaymentStatus(orderId, PaymentStatus.PENDING))
        .rejects.toThrow(/Manual transition to PENDING is not allowed/);
      
      expect(mockRepo.save).toHaveBeenCalledTimes(0);
    });

    it('harus melempar error jika data pembayaran tidak ditemukan (Sad Path)', async () => {
      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(null);

      await expect(paymentService.updatePaymentStatus('NON-EXISTENT', PaymentStatus.PAID))
        .rejects.toThrow('Payment not found');
    });

    it('harus langsung kembali (idempoten) jika status pembayaran sudah final (Idempotensi)', async () => {
      const orderId = 'ORD-123';
      const existingPayment = Payment.create(orderId, 10000);
      existingPayment.complete(); // Status: PAID

      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(existingPayment);

      const result = await paymentService.updatePaymentStatus(orderId, PaymentStatus.PAID);

      expect(result).toBe(existingPayment);
      expect(mockRepo.save).toHaveBeenCalledTimes(0);
    });
  });
});
