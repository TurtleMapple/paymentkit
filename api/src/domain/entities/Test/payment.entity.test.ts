import { describe, it, expect } from 'vitest';
import { Payment } from '../paymentEntity';
import { PaymentStatus } from '../paymentStatus';

describe('Payment Entity - Rich Domain Model', () => {

  describe('Creation (Invariant Validation)', () => {
    it('harus berhasil membuat payment baru dengan status PENDING', () => {
      const orderId = 'ORD-123';
      const amount = 100000;
      const payment = Payment.create(orderId, amount);

      expect(payment.orderId).toBe(orderId);
      expect(payment.getAmount()).toBe(amount);
      expect(payment.getStatus()).toBe(PaymentStatus.PENDING);
    });

    it('harus melempar error jika amount <= 0', () => {
      expect(() => Payment.create('ORD-1', 0)).toThrow('Payment amount must be greater than zero');
      expect(() => Payment.create('ORD-1', -500)).toThrow('Payment amount must be greater than zero');
    });

    it('harus melempar error jika Order ID kosong', () => {
      expect(() => Payment.create('', 1000)).toThrow('Order ID is required');
    });
  });

  describe('State Transitions (Status Machine)', () => {
    it('harus bisa bertransisi dari PENDING ke PAID via complete()', () => {
      const payment = Payment.create('ORD-1', 1000);
      const paidAt = new Date();
      payment.complete(paidAt, { reference_id: 'REF-1' });

      expect(payment.getStatus()).toBe(PaymentStatus.PAID);
      expect(payment.paidAt).toEqual(paidAt);
      expect(payment.gatewayResponse).toEqual({ reference_id: 'REF-1' });
    });

    it('harus bisa bertransisi dari PENDING ke FAILED via fail()', () => {
      const payment = Payment.create('ORD-1', 1000);
      payment.fail('Direct failure');

      expect(payment.getStatus()).toBe(PaymentStatus.FAILED);
      expect(payment.gatewayResponse).toHaveProperty('failure_reason', 'Direct failure');
    });

    it('harus melempar error jika transisi tidak valid (misal: PAID ke EXPIRED)', () => {
      const payment = Payment.create('ORD-1', 1000);
      payment.complete();
      
      expect(() => payment.expire()).toThrow('Invalid transition from PAID to EXPIRED');
    });

    it('harus idempoten jika transisi ke status yang sama', () => {
      const payment = Payment.create('ORD-1', 1000);
      payment.complete();
      
      // Memanggil complete() lagi tidak boleh melempar error
      expect(() => payment.complete()).not.toThrow();
      expect(payment.getStatus()).toBe(PaymentStatus.PAID);
    });
  });

  describe('Business Actions', () => {
    it('harus bisa memperbarui metadata gateway tanpa merubah status', () => {
      const payment = Payment.create('ORD-1', 1000);
      payment.updateGatewayMeta({ type: 'bank_transfer', bank: 'bca' });

      expect(payment.paymentType).toBe('bank_transfer');
      expect(payment.bank).toBe('bca');
      expect(payment.getStatus()).toBe(PaymentStatus.PENDING);
    });

    it('harus bisa menambah hitungan percobaan (increment attempt)', () => {
      const payment = Payment.create('ORD-1', 1000);
      payment.incrementAttempt();
      payment.incrementAttempt();

      expect(payment.paymentAttemptCount).toBe(2);
    });
  });

});
