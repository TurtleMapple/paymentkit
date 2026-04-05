import { describe, it, expect } from 'vitest';
import { CustomerInfoSchema } from '../customer.schema';

describe('CustomerInfoSchema - Unit & Gray Box Testing', () => {

  describe('Red Flag Testing (Skenario Gagal / Negative Testing)', () => {

    it('harus menolak request jika "customerEmail" bukan format email yang valid', () => {
      const payloadInvalidEmail = {
        customerName: 'Ahmad Faisal',
        customerEmail: 'ahmadfaisal(at)gmail.com', // Format salah
        phone: '08123456789'
      };

      const result = CustomerInfoSchema.safeParse(payloadInvalidEmail);
      expect(result.success).toBe(false);
    });

    it('harus menolak request jika "customerName" kosong atau lebih dari 128 karakter', () => {
      const payloadEmptyName = {
        customerName: '', // Min 1
        customerEmail: 'ahmad@example.com',
        phone: '08123456789'
      };
      
      const payloadTooLongName = {
        customerName: 'A'.repeat(129), // Max 128
        customerEmail: 'ahmad@example.com',
        phone: '08123456789'
      };

      expect(CustomerInfoSchema.safeParse(payloadEmptyName).success).toBe(false);
      expect(CustomerInfoSchema.safeParse(payloadTooLongName).success).toBe(false);
    });

    it('harus menolak request jika "phone" kosong atau hilang', () => {
      const payloadEmptyPhone = {
        customerName: 'Budi',
        customerEmail: 'budi@example.com',
        phone: '' // Min 1
      };

      expect(CustomerInfoSchema.safeParse(payloadEmptyPhone).success).toBe(false);
    });

  });

  describe('Green Flag Testing (Skenario Berhasil / Positive Testing)', () => {

    it('harus menerima format data customer yang utuh dan valid', () => {
      const validPayload = {
        customerName: 'Muhammad Rizky',
        customerEmail: 'rizky.muh@example.com',
        phone: '+6281234567890'
      };

      const result = CustomerInfoSchema.safeParse(validPayload);
      
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.customerName).toBe('Muhammad Rizky');
        expect(result.data.customerEmail).toBe('rizky.muh@example.com');
        expect(result.data.phone).toBe('+6281234567890');
      }
    });
    
  });
});
