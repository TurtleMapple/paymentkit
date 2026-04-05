import { describe, it, expect } from 'vitest';
import { CreateInvoiceRequestSchema, InvoiceResponseSchema } from '../invoice.schema';

describe('Invoice Schema - Unit & Gray Box Testing', () => {

  describe('CreateInvoiceRequestSchema', () => {
    
    describe('Red Flag Testing (Skenario Gagal)', () => {
      it('harus menolak invoice jika amount bukan integer positif', () => {
        const payloadInvalidAmount = {
          amount: -100, // Harus positif
          customer: { customerName: 'Joko', customerEmail: 'joko@abc.com', phone: '08111' }
        };

        const result = CreateInvoiceRequestSchema.safeParse(payloadInvalidAmount);
        expect(result.success).toBe(false);
      });

      it('harus menolak invoice jika skema customer di dalamnya tidak lengkap', () => {
        const payloadInvalidCustomer = {
          amount: 50000,
          gateway: 'midtrans',
          customer: {
            customerName: 'Joko' // Kurang email dan phone
          }
        };

        const result = CreateInvoiceRequestSchema.safeParse(payloadInvalidCustomer);
        expect(result.success).toBe(false);
      });
    });

    describe('Green Flag Testing (Skenario Berhasil)', () => {
      it('harus menerima invoice yang valid lengkap dengan gateway default "midtrans" jika tidak diisi', () => {
        const payloadNoGateway = {
          amount: 150000,
          customer: { customerName: 'Citra', customerEmail: 'citra@example.com', phone: '08999' }
        };

        const result = CreateInvoiceRequestSchema.safeParse(payloadNoGateway);
        expect(result.success).toBe(true);
        
        if (result.success) {
          // Validasi internal: apakah fallback "default" berjalan
          expect(result.data.gateway).toBe('midtrans');
          expect(result.data.amount).toBe(150000);
        }
      });
    });
    
  });

  describe('InvoiceResponseSchema', () => {
    
    describe('Red Flag Testing (Skenario Gagal)', () => {
      it('harus menolak response dari backend apabila ID tidak berupa UUID', () => {
        const invalidUUIDResponse = {
          id: 'bukan-uuid',
          orderId: 'ORD-123',
          amount: 50000,
          status: 'PENDING',
          gateway: 'midtrans',
          paymentLink: null,
          expiredAt: null,
          customerName: 'Test',
          customerEmail: 'test@test.com',
          createdAt: new Date().toISOString()
        };

        expect(InvoiceResponseSchema.safeParse(invalidUUIDResponse).success).toBe(false);
      });
      
      it('harus menolak apabila status invoice di luar enum yang disetujui', () => {
        const invalidStatusResponse = {
          id: '550e8400-e29b-41d4-a716-446655440000', // UUID valid
          orderId: 'ORD-123',
          amount: 50000,
          status: 'BERHASIL_DIBAYAR', // Invalid enum (harusnya PAID)
          gateway: 'midtrans',
          paymentLink: null,
          expiredAt: null,
          customerName: null,
          customerEmail: null,
          createdAt: new Date().toISOString()
        };

        expect(InvoiceResponseSchema.safeParse(invalidStatusResponse).success).toBe(false);
      });
    });

    describe('Green Flag Testing (Skenario Berhasil)', () => {
      it('harus menerima format response yang memiliki field nullable', () => {
        const validResponse = {
          id: '123e4567-e89b-12d3-a456-426614174000', 
          orderId: 'ORDER-999',
          amount: 75000,
          status: 'PAID',
          gateway: 'xendit',
          paymentLink: 'https://link.com/pay',
          expiredAt: '2023-12-31T23:59:59Z',
          customerName: null, // Boleh null
          customerEmail: null, // Boleh null
          createdAt: '2023-12-01T10:00:00Z'
        };

        const result = InvoiceResponseSchema.safeParse(validResponse);
        expect(result.success).toBe(true);
      });
    });
    
  });

});
