import { expect, it, vi, describe, beforeEach, afterEach } from 'vitest';
import { MidtransPaymentGateway } from '../MidtransPaymentGateway';
import { PaymentStatus } from '../../entities/paymentStatus';
import { 
    GatewayValidationException, 
    GatewayAuthException, 
    BaseGatewayException 
} from '../../exceptions/gateway.exception';

// Simpan original fetch untuk direstore nantinya
const originalFetch = global.fetch;

describe('MidtransPaymentGateway', () => {
    let gateway: MidtransPaymentGateway;

    beforeEach(() => {
        gateway = new MidtransPaymentGateway();
        // Mock global.fetch sebelum setiap test
        global.fetch = vi.fn();
    });

    afterEach(() => {
        // Restore fetch ke kondisi asli
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    describe('createPayment', () => {
        it('should successfully create a payment link and pass idempotency key', async () => {
            const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue({
                    payment_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/xyz123',
                    expiry_time: '2030-01-01 12:00:00'
                })
            };
            vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

            const result = await gateway.createPayment({
                orderId: 'ORD-TEST-123',
                amount: 50000,
                idempotencyKey: 'IDEMP-KEY-1'
            });

            expect(result.orderId).toBe('ORD-TEST-123');
            expect(result.paymentLink).toBe('https://app.sandbox.midtrans.com/snap/v2/vtweb/xyz123');
            
            // Verifikasi bahwa fetch dipanggil dengan header Idempotency
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/v1/payment-links'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'X-Idempotency-Key': 'IDEMP-KEY-1'
                    })
                })
            );
        });

        it('should fall back to orderId if idempotencyKey is not provided', async () => {
            const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue({
                    payment_url: 'https://example.com/pay',
                })
            };
            vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

            await gateway.createPayment({
                orderId: 'ORD-NO-IDEMP',
                amount: 50000
            });

            // Fallback: orderId bertindak sebagai Idempotency-Key
            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-Idempotency-Key': 'ORD-NO-IDEMP'
                    })
                })
            );
        });

        it('should throw GatewayAuthException strictly on 401 error', async () => {
            const mockResponse = {
                ok: false,
                status: 401,
                json: vi.fn().mockResolvedValue({
                    error_messages: ['Access denied due to unauthorized server key']
                })
            };
            vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

            await expect(gateway.createPayment({
                orderId: 'ORD-TEST-401',
                amount: 10000
            })).rejects.toThrow(GatewayAuthException);
        });

        it('should throw GatewayValidationException on 400 Bad Request error', async () => {
            const mockResponse = {
                ok: false,
                status: 400,
                json: vi.fn().mockResolvedValue({
                    error_messages: ['amount is required']
                })
            };
            vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

            await expect(gateway.createPayment({
                orderId: 'ORD-TEST-400',
                amount: -100 // invalid amount logic test
            })).rejects.toThrow(GatewayValidationException);
        });
    });

    describe('checkStatus', () => {
        it('should map status properly from Midtrans response', async () => {
             const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue({
                    order_id: 'ORD-1',
                    transaction_status: 'settlement',
                    payment_type: 'bank_transfer',
                    settlement_time: '2023-01-01 10:00:00'
                })
            };
            vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

            const result = await gateway.checkStatus({ orderId: 'ORD-1' });

            // Settlement di midtrans harus diconvert jadi PAID
            expect(result.status).toBe(PaymentStatus.PAID); 
        });

        it('should return PENDING if order is not found (404) natively in CheckStatus', async () => {
             const mockResponse = {
                ok: false,
                status: 404,
                json: vi.fn().mockResolvedValue({})
            };
            vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

            // Karena kadang kita check status di awal webhook datang, dan midtrans belum sync
            const result = await gateway.checkStatus({ orderId: 'ORD-404' });
            expect(result.status).toBe(PaymentStatus.PENDING);
        });
    });
});
