import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentHandler } from '../payment.handler';
import { HttpStatus } from '../../utils/http-status.util';
import { Payment } from '../../domain/entities/paymentEntity';

// Mock dependensi eksternal: PaymentService
const mockPaymentService = {
  createPayment: vi.fn(),
  getPaymentByOrderId: vi.fn(),
  getAllPayments: vi.fn(),
};

// Mock dependensi Hono Context
const mockContext = {
  json: vi.fn((data, status: any) => ({ type: 'json', data, status })),
} as any;

describe('Payment Handler - Unit & Gray Box Testing', () => {
  let handler: PaymentHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new PaymentHandler(mockPaymentService);
  });

  describe('createPayment Endpoint', () => {
    describe('Red Flag Testing (Skenario Gagal / Exceptions)', () => {
      it('harus meneruskan error (melempar kembali) jika service gagal membuat pembayaran (misal: ID order duplikat)', async () => {
        mockPaymentService.createPayment.mockRejectedValue(new Error('Order ID already exists'));

        const mockInput = {
          amount: 50000,
          customer: { customerName: 'Fatur', customerEmail: 'fatur@example.com', phone: '0812' }
        };

        await expect(handler.createPayment(mockContext, mockInput)).rejects.toThrow('Order ID already exists');
        expect(mockContext.json).not.toHaveBeenCalled();
      });
    });

    describe('Green Flag Testing (Skenario Berhasil)', () => {
      it('harus merespons dengan format standar (JSON, 201) ketika pembuatan pembayaran berhasil di service', async () => {
        // [Stub] Simulasikan data berhasil terbuat dari Service menggunakan Entity Asli
        const fakeCreatedPayment = Payment.create('UUID-999', 50000);
        mockPaymentService.createPayment.mockResolvedValue(fakeCreatedPayment);

        const mockInput = {
          amount: 50000,
          customer: { customerName: 'Fatur', customerEmail: 'fatur@example.com', phone: '0812' }
        };

        await handler.createPayment(mockContext, mockInput);

        // [Assertions]
        expect(mockPaymentService.createPayment).toHaveBeenCalledTimes(1);
        expect(mockContext.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({ 
              orderId: 'UUID-999', 
              amount: 50000 
            }),
            message: 'Payment created successfully'
          }),
          HttpStatus.CREATED
        );
      });
    });
  });

  describe('getPaymentByOrderId Endpoint', () => {
    describe('Red Flag Testing (Skenario Gagal / Exceptions)', () => {
      it('harus melempar *throw Error* spesifik jika payment dari DB yang dikembalikan service adalah "null" / kosong', async () => {
        mockPaymentService.getPaymentByOrderId.mockResolvedValue(null);

        await expect(handler.getPaymentByOrderId(mockContext, 'ORD-UNKNOWN'))
          .rejects.toThrow('Payment not found');
      });
    });

    describe('Green Flag Testing (Skenario Berhasil)', () => {
      it('harus mengambil data, memformatnya, dan mengembalikan status 200 OK ketika record ditemukan', async () => {
        const fakeFoundPayment = Payment.create('ORD-KNOWN', 10000);
        mockPaymentService.getPaymentByOrderId.mockResolvedValue(fakeFoundPayment);

        await handler.getPaymentByOrderId(mockContext, 'ORD-KNOWN');

        expect(mockContext.json).toHaveBeenCalledWith(
          expect.objectContaining({ 
            success: true,
            data: expect.objectContaining({ orderId: 'ORD-KNOWN' })
          }),
          HttpStatus.OK
        );
      });
    });
  });

});