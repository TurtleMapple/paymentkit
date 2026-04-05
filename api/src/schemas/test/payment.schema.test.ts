import { describe, it, expect } from 'vitest';
import { CreatePaymentSchema } from '../payment.schema';

describe('CreatePaymentSchema - Unit & Gray Box Testing', () => {
  // Catatan: Karena validasi Zod adalah pure-function (fungsi murni), 
  // kita tidak memerlukan stub/mock untuk dependensi eksternal (DB/API) di sini.
  
  describe('Red Flag Testing (Skenario Gagal / Negative Testing)', () => {

    it('harus menolak request jika "amount" bernilai negatif atau nol', () => {
      // Menguji struktur internal: zod schema mengharuskan positive() 
      const payloadZero = {
        amount: 0,
        customer: { customerName: 'John', customerEmail: 'john@doe.com', phone: '08123' }
      };
      const payloadNegative = {
        amount: -50000,
        customer: { customerName: 'John', customerEmail: 'john@doe.com', phone: '08123' }
      };

      expect(CreatePaymentSchema.safeParse(payloadZero).success).toBe(false);
      expect(CreatePaymentSchema.safeParse(payloadNegative).success).toBe(false);
    });

    it('harus menolak request jika "amount" bukan integer (bernilai desimal)', () => {
      // Menguji struktur internal: zod schema mengharuskan int()
      const payloadDecimal = {
        amount: 50000.5,
        customer: { customerName: 'John', customerEmail: 'john@doe.com', phone: '08123' }
      };

      const result = CreatePaymentSchema.safeParse(payloadDecimal);
      expect(result.success).toBe(false);
      
      // Memeriksa pesan error spesifik jika diperlukan (Gray-box testing)
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_type');
      }
    });

    it('harus menolak request jika "customerEmail" memiliki format yang salah', () => {
      const payloadInvalidEmail = {
        amount: 50000,
        customer: { 
          customerName: 'John Doe', 
          customerEmail: 'johndoe-tanpa-domain', // Invalid email format
          phone: '0812345678' 
        }
      };

      const result = CreatePaymentSchema.safeParse(payloadInvalidEmail);
      expect(result.success).toBe(false);
    });

    it('harus menolak request jika data "customer" hilang (undefined)', () => {
      const payloadNoCustomer = {
        amount: 50000,
        // customer field missing
      };

      const result = CreatePaymentSchema.safeParse(payloadNoCustomer);
      expect(result.success).toBe(false);
    });
  });

  describe('Green Flag Testing (Skenario Berhasil / Positive Testing)', () => {
    // User: "setelah itu aku akan mengubahnya menjadi green flag."
    // Berikut format yang disiapkan untuk Anda implementasikan lebih lanjut:

    it('harus menerima request dengan struktur data yang valid sempurna', () => {
      const validPayload = {
        amount: 100000,
        customer: {
          customerName: 'Budi Santoso',
          customerEmail: 'budi.santoso@example.com',
          phone: '081234567890'
        }
      };

      const result = CreatePaymentSchema.safeParse(validPayload);
      
      // Assertion untuk green path
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.amount).toBe(100000);
        expect(result.data.customer.customerName).toBe('Budi Santoso');
      }
    });
  });
});
