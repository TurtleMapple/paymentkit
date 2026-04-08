import { describe, it, expect } from 'vitest';
import { PaymentGatewayFactory } from '../PaymentGatewayFactory';
import { MidtransPaymentGateway } from '../MidtransPaymentGateway';

describe('PaymentGatewayFactory', () => {
  it('harus membuat MidtransPaymentGateway ketika diminta', () => {
    const gateway = PaymentGatewayFactory.create('midtrans');
    
    expect(gateway).toBeInstanceOf(MidtransPaymentGateway);
    expect(gateway.name).toBe('midtrans');
  });

  it('harus mengabaikan perbedaan huruf besar/kecil pada nama gateway', () => {
    const gateway = PaymentGatewayFactory.create('MIDTRANS');
    
    expect(gateway).toBeInstanceOf(MidtransPaymentGateway);
  });

  it('harus mengembalikan instance yang SAMA (Singleton Pattern)', () => {
    const instance1 = PaymentGatewayFactory.create('midtrans');
    const instance2 = PaymentGatewayFactory.create('midtrans');
    
    // Periksa apakah referensi memorinya sama
    expect(instance1).toBe(instance2);
  });

  it('harus melempar error jika gateway tidak didukung', () => {
    expect(() => {
      PaymentGatewayFactory.create('not-supported-gateway');
    }).toThrow(/is not supported/);
  });
});
