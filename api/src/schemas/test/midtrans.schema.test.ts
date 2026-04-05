import { describe, it, expect } from 'vitest';
import { 
  MidtransCustomerDetailsSchema, 
  MidtransItemDetailsSchema, 
  MidtransWebhookSchema 
} from '../midtrans.schema';

describe('Midtrans Schema - Unit & Gray Box Testing', () => {

  describe('MidtransCustomerDetailsSchema', () => {
    describe('Red Flag Testing (Skenario Gagal)', () => {
      it('harus menolak jika "email" bukan format email yang benar', () => {
        const payloadInvalid = {
          first_name: 'Budi',
          email: 'bukan-email'
        };
        expect(MidtransCustomerDetailsSchema.safeParse(payloadInvalid).success).toBe(false);
      });

      it('harus menolak jika "first_name" tidak ada karena ini diwajibkan oleh Midtrans', () => {
        const payloadNoFirstName = {
          last_name: 'Pekerti',
          email: 'budi@example.com'
        };
        expect(MidtransCustomerDetailsSchema.safeParse(payloadNoFirstName).success).toBe(false);
      });
    });

    describe('Green Flag Testing (Skenario Berhasil)', () => {
      it('harus menerima data dengan "first_name" dan "email" saja tanpa field opsional lainnya', () => {
        const payloadValid = {
          first_name: 'Siti',
          email: 'siti@example.com' // last_name, phone dll dibiarkan kosong
        };
        expect(MidtransCustomerDetailsSchema.safeParse(payloadValid).success).toBe(true);
      });
      
      it('harus menerima payload yang memiliki nested object seperti billing_address', () => {
        const payloadValidFull = {
          first_name: 'Ari',
          email: 'ari@example.com',
          billing_address: {
            first_name: 'Ari', // Wajib jika mengisi billing_address
            address: 'Jalan Kenangan'
          }
        };
        expect(MidtransCustomerDetailsSchema.safeParse(payloadValidFull).success).toBe(true);
      });
    });
  });

  describe('MidtransItemDetailsSchema', () => {
    describe('Red Flag Testing (Skenario Gagal)', () => {
      it('harus menolak item jika "name" melebihi batas 50 karakter', () => {
        const payloadTooLongName = {
          id: 'ITEM-1',
          price: 50000,
          quantity: 1,
          name: 'P'.repeat(51) // Melebihi 50 karakter
        };
        expect(MidtransItemDetailsSchema.safeParse(payloadTooLongName).success).toBe(false);
      });
    });

    describe('Green Flag Testing (Skenario Berhasil)', () => {
      it('harus menerima spesifikasi item yang valid untuk checkout', () => {
        const payloadValidItem = {
          id: 'ITEM-123',
          price: 150000,
          quantity: 2,
          name: 'Sepatu Bola Spesial'
        };
        expect(MidtransItemDetailsSchema.safeParse(payloadValidItem).success).toBe(true);
      });
    });
  });

  describe('MidtransWebhookSchema', () => {
    describe('Red Flag Testing (Skenario Gagal)', () => {
      it('harus menolak webhook dari payload yang strukturnya tidak lengkap (hilangnya signature_key)', () => {
        const payloadInvalidWebhook = {
          transaction_id: 'TRX-123',
          order_id: 'ORD-999',
          gross_amount: '10000.00',
          payment_type: 'bank_transfer',
          transaction_time: '2023-11-20 15:00:00',
          transaction_status: 'settlement',
          status_code: '200'
          // signature_key hilang!
        };
        expect(MidtransWebhookSchema.safeParse(payloadInvalidWebhook).success).toBe(false);
      });
    });

    describe('Green Flag Testing (Skenario Berhasil)', () => {
      it('harus menerima valid payload notifikasi HTTP bertipe string dari Midtrans', () => {
        const payloadValidWebhook = {
          transaction_id: '50e8fca5-b3a5-4eb4-b903-f32fc01fe97a',
          order_id: 'ORDER-102',
          gross_amount: '120000.00', // Midtrans mengirimkan format string decimal
          payment_type: 'qris',
          transaction_time: '2024-02-12 10:15:22',
          transaction_status: 'settlement',
          status_code: '200',
          signature_key: 'b3bc...signature...hash'
        };
        expect(MidtransWebhookSchema.safeParse(payloadValidWebhook).success).toBe(true);
      });
    });
  });

});
