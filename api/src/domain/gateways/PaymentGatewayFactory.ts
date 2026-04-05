import { PaymentGateway } from './IPaymentGateway';
import { MidtransPaymentGateway } from './MidtransPaymentGateway';

/**
 * Factory untuk membuat instance payment gateway (Menerapkan Singleton Pattern)
 */
export class PaymentGatewayFactory {
  // Map untuk menyimpan instances gateway yang sudah dibuat agar tidak boros memory (Singleton Pattern)
  private static instances: Map<string, PaymentGateway> = new Map();

  static create(gatewayName: string): PaymentGateway {
    const name = gatewayName.toLowerCase();

    // Kembalikan instance yang sudah ada di memory
    if (this.instances.has(name)) {
      return this.instances.get(name)!;
    }

    let gateway: PaymentGateway;

    // Registrasi gateway baru jika belum ada
    switch (name) {
      case 'midtrans':
        gateway = new MidtransPaymentGateway();
        break;
      // Tinggal tambahkan case stripe/xendit di masa lusa di sini
      default:
        throw new Error(`Gateway '${gatewayName}' is not supported`);
    }

    // Simpan gateway ke dalam dictionary Map
    this.instances.set(name, gateway);
    return gateway;
  }
}
