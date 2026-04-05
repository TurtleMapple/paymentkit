import { describe, it, expect } from 'vitest';
import { PaymentGatewayFactory } from '../PaymentGatewayFactory';
import { MidtransPaymentGateway } from '../MidtransPaymentGateway';

describe('PaymentGatewayFactory', () => {
  it('should create MidtransPaymentGateway when requested', () => {
    const gateway = PaymentGatewayFactory.create('midtrans');
    
    expect(gateway).toBeInstanceOf(MidtransPaymentGateway);
    expect(gateway.name).toBe('midtrans');
  });

  it('should be case-insensitive for gateway names', () => {
    const gateway = PaymentGatewayFactory.create('MIDTRANS');
    
    expect(gateway).toBeInstanceOf(MidtransPaymentGateway);
  });

  it('should return the SAME instance (Singleton Pattern)', () => {
    const instance1 = PaymentGatewayFactory.create('midtrans');
    const instance2 = PaymentGatewayFactory.create('midtrans');
    
    // Periksa apakah referensi memorinya sama
    expect(instance1).toBe(instance2);
  });

  it('should throw error for unsupported gateway', () => {
    expect(() => {
      PaymentGatewayFactory.create('not-supported-gateway');
    }).toThrow(/is not supported/);
  });
});
