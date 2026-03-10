import { PaymentGateway } from './IPaymentGateway';
import { MidtransPaymentGateway } from './MidtransPaymentGateway';

/**
 * Factory untuk membuat instance payment gateway
 */
export class PaymentGatewayFactory {
  static create(gatewayName: string): PaymentGateway {
    // amazonq-ignore-next-line
    // amazonq-ignore-next-line
    switch (gatewayName.toLowerCase()) {
      case 'midtrans':
        return new MidtransPaymentGateway();
      default:
        throw new Error(`Gateway '${gatewayName}' is not supported`);
    }
  }
}
