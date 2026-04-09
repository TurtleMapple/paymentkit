import { describe, it, expect } from 'vitest';
import { 
  WebhookRequestSchema, 
  WebhookResponseSchema, 
  WebhookGatewayParamSchema 
} from '../webhook.schema';

describe('Webhook Schema - Unit & Gray Box Testing', () => {

  describe('WebhookRequestSchema', () => {
    describe('Green Flag Testing (Skenario Berhasil)', () => {
      it('harus menerima pass-through object apa pun dari eksternal karena divalidasi manual di provider handler', () => {
        // Karena schemanya di-set sebagai `.passthrough()`, 
        // ia harus menerima semua bentuk JSON yang sah.
        const payloadMidtrans = { transaction_status: 'settlement', order_id: '123' };
        const payloadXendit = { status: 'PAID', external_id: '123' };
        
        expect(WebhookRequestSchema.safeParse(payloadMidtrans).success).toBe(true);
        expect(WebhookRequestSchema.safeParse(payloadXendit).success).toBe(true);
      });
    });
  });

  describe('WebhookResponseSchema', () => {
    describe('Red Flag Testing (Skenario Gagal)', () => {
      it('harus menolak jika property "success" hilang atau nilainya bukan boolean', () => {
        const payloadNoSuccess = {
          message: 'Webhook processed'
        };
        const payloadStringSuccess = {
          success: 'true', // tipe string, bukan boolean
          message: 'Webhook processed'
        };

        expect(WebhookResponseSchema.safeParse(payloadNoSuccess).success).toBe(false);
        expect(WebhookResponseSchema.safeParse(payloadStringSuccess).success).toBe(false);
      });

      it('harus menolak jika property "message" (tipe string) hilang', () => {
        const payloadNoMessage = {
          success: true
        };

        expect(WebhookResponseSchema.safeParse(payloadNoMessage).success).toBe(false);
      });
    });

    describe('Green Flag Testing (Skenario Berhasil)', () => {
      it('harus menerima struktur standar dengan success dan message saja (tanpa data opsional)', () => {
        const minimalResponse = {
          success: true,
          message: 'Webhook processed successfully'
        };

        expect(WebhookResponseSchema.safeParse(minimalResponse).success).toBe(true);
      });

      it('harus menerima struktur lengkap yang mengandung data invoice dan waktu pemrosesan', () => {
        const fullResponse = {
          success: true,
          message: 'Invoice status updated',
          invoice: { id: 'INV-123', status: 'PAID' },
          processedAt: '2023-11-20T10:15:20Z'
        };

        expect(WebhookResponseSchema.safeParse(fullResponse).success).toBe(true);
      });
    });
  });

  describe('WebhookGatewayParamSchema', () => {
    describe('Red Flag Testing (Skenario Gagal)', () => {
      it('harus menolak karena paramter URL "gateway" kosong (string empty)', () => {
        const emptyParam = { gateway: '' };
        expect(WebhookGatewayParamSchema.safeParse(emptyParam).success).toBe(false);
      });
    });

    describe('Green Flag Testing (Skenario Berhasil)', () => {
      it('harus menerima berbagai nama gateway selama tidak kosong', () => {
        expect(WebhookGatewayParamSchema.safeParse({ gateway: 'midtrans' }).success).toBe(true);
        expect(WebhookGatewayParamSchema.safeParse({ gateway: 'xendit' }).success).toBe(true);
      });
    });
  });

});
