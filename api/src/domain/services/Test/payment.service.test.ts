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
    it('should create a payment successfully (Happy Path)', async () => {
      const orderId = 'ORD-123';
      const mockPayment = Payment.create(orderId, 10000);

      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(null);
      vi.mocked(mockRepo.save).mockResolvedValue(undefined);

      const result = await paymentService.createPayment(orderId, 10000, 'midtrans');

      expect(result.orderId).toBe(orderId);
      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockPublisher.publishPaymentCreated).toHaveBeenCalledWith(orderId);
    });

    it('should throw error if Order ID already exists (Sad Path)', async () => {
      const orderId = 'ORD-123';
      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(Payment.create(orderId, 10000));

      await expect(paymentService.createPayment(orderId, 10000, 'midtrans'))
        .rejects.toThrow('Order ID already exists');
      
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('updatePaymentStatus()', () => {
    it('should update status successfully (Happy Path)', async () => {
      const orderId = 'ORD-123';
      const existingPayment = Payment.create(orderId, 10000);

      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(existingPayment);
      vi.mocked(mockRepo.save).mockResolvedValue(undefined);

      const result = await paymentService.updatePaymentStatus(orderId, PaymentStatus.PAID);

      expect(result.getStatus()).toBe(PaymentStatus.PAID);
      expect(mockRepo.save).toHaveBeenCalledWith(existingPayment);
      expect(mockPublisher.publishPaymentUpdated).toHaveBeenCalledWith(orderId, PaymentStatus.PAID);
    });

    it('should throw error if transition is invalid (Sad Path)', async () => {
      const orderId = 'ORD-123';
      const existingPayment = Payment.create(orderId, 10000);
      existingPayment.complete(); // Status: PAID

      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(existingPayment);

      await expect(paymentService.updatePaymentStatus(orderId, PaymentStatus.PENDING))
        .rejects.toThrow(/Manual transition to PENDING is not allowed/);
      
      expect(mockRepo.save).toHaveBeenCalledTimes(0);
    });

    it('should throw error if payment is not found (Sad Path)', async () => {
      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(null);

      await expect(paymentService.updatePaymentStatus('NON-EXISTENT', PaymentStatus.PAID))
        .rejects.toThrow('Payment not found');
    });

    it('should return immediately if payment is already in final state (Idempotency)', async () => {
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
