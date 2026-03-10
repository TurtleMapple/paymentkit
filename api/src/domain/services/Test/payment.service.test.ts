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
      create: vi.fn(),
      updateStatus: vi.fn(),
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
      const mockPayment = { orderId, status: PaymentStatus.PENDING } as Payment;

      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(null);
      vi.mocked(mockRepo.create).mockResolvedValue(mockPayment);

      const result = await paymentService.createPayment(orderId, 10000, 'midtrans');

      expect(result).toBe(mockPayment);
      expect(mockRepo.create).toHaveBeenCalledWith(orderId, 10000, 'midtrans', undefined, undefined);
      expect(mockPublisher.publishPaymentCreated).toHaveBeenCalledWith(orderId);
    });

    it('should throw error if Order ID already exists (Sad Path)', async () => {
      const orderId = 'ORD-123';
      vi.mocked(mockRepo.findByOrderId).mockResolvedValue({ orderId } as Payment);

      await expect(paymentService.createPayment(orderId, 10000, 'midtrans'))
        .rejects.toThrow('Order ID already exists');
      
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('updatePaymentStatus()', () => {
    it('should update status successfully (Happy Path)', async () => {
      const orderId = 'ORD-123';
      const existingPayment = { orderId, status: PaymentStatus.PENDING } as Payment;
      const updatedPayment = { ...existingPayment, status: PaymentStatus.PAID } as Payment;

      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(existingPayment);
      vi.mocked(mockRepo.updateStatus).mockResolvedValue(updatedPayment);

      const result = await paymentService.updatePaymentStatus(orderId, PaymentStatus.PAID);

      expect(result.status).toBe(PaymentStatus.PAID);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(orderId, PaymentStatus.PAID, undefined);
      expect(mockPublisher.publishPaymentUpdated).toHaveBeenCalledWith(orderId, PaymentStatus.PAID);
    });

    it('should throw error if transition is invalid (Sad Path)', async () => {
      const orderId = 'ORD-123';
      const existingPayment = { orderId, status: PaymentStatus.PAID } as Payment;

      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(existingPayment);

      await expect(paymentService.updatePaymentStatus(orderId, PaymentStatus.PENDING))
        .rejects.toThrow(/Invalid transition/);
      
      expect(mockRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw error if payment is not found (Sad Path)', async () => {
      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(null);

      await expect(paymentService.updatePaymentStatus('NON-EXISTENT', PaymentStatus.PAID))
        .rejects.toThrow('Payment not found');
    });

    it('should return immediately if payment is already in final state (Idempotency)', async () => {
      const orderId = 'ORD-123';
      const existingPayment = { orderId, status: PaymentStatus.PAID } as Payment;

      vi.mocked(mockRepo.findByOrderId).mockResolvedValue(existingPayment);

      const result = await paymentService.updatePaymentStatus(orderId, PaymentStatus.PAID);

      expect(result).toBe(existingPayment);
      expect(mockRepo.updateStatus).not.toHaveBeenCalled();
    });
  });
});
