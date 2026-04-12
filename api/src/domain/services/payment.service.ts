import { PaymentStatus } from '../entities/paymentStatus';
import { Payment } from '../entities/paymentEntity';
import { IPaymentRepository } from '../repositories/IPaymentRepository';
import { IPaymentEventPublisher } from './IPaymentEventPublisher';
import { PaymentGatewayFactory } from '../gateways/PaymentGatewayFactory';

/**
 * PAYMENT SERVICE (Application Service / Use Case Layer)
 * 
 * Tanggung Jawab:
 * - Orkestrasi alur kerja (load -> act -> save -> publish).
 * - Tidak mengandung logika bisnis inti (logic ada di Payment Entity).
 * - Stateless dan bergantung pada abstraksi.
 */
export class PaymentService {
  constructor(
    private readonly repo: IPaymentRepository,
    private readonly publisher: IPaymentEventPublisher
  ) { }

  /**
   * Use Case: Membuat pembayaran baru secara Sinkron
   * Langsung mendapatkan link pembayaran dari Gateway (Midtrans, dll).
   */
  async createPayment(
    orderId: string,
    amount: number,
    gatewayName: string,
    customerName?: string,
    customerEmail?: string
  ): Promise<Payment> {
    // 1. Cek duplikasi (Business Side Rule)
    const existing = await this.repo.findByOrderId(orderId);
    if (existing) {
      throw new Error('Order ID already exists');
    }

    // 2. Inisialisasi Domain Entity via Static Factory
    const payment = Payment.create(orderId, amount, gatewayName);
    payment.customerName = customerName;
    payment.customerEmail = customerEmail;

    // 3. Panggil Gateway secara SINKRON untuk membuat link pembayaran
    // Keuntungan: User langsung mendapatkan link di respon pertama.
    const gateway = PaymentGatewayFactory.create(gatewayName);
    const gatewayResult = await gateway.createPayment({
      orderId,
      amount,
      customerName,
      customerEmail
    });

    // 4. Update data link dari gateway ke Entity
    payment.updateGatewayMeta({
      link: gatewayResult.paymentLink,
      expiredAt: gatewayResult.expiredAt,
      type: gatewayResult.paymentType
    });
    
    // Simpan respon mentah untuk audit trail
    if (gatewayResult.gatewayResponse) {
      // Kita panggil complete manual atau set langsung meta
      // Karena ini masih PENDING, kita update metanya saja
    }

    // 5. Persistensi ke Database
    await this.repo.save(payment);

    // 6. Publikasi Event Kesuksesan (Agar sistem lain/worker tetap tahu ada payment baru)
    await this.publisher.publishPaymentCreated(orderId);

    return payment;
  }

  /**
   * Use Case: Memperbarui status pembayaran berdasarkan notifikasi gateway
   */
  async updatePaymentStatus(
    orderId: string,
    newStatus: PaymentStatus,
    paymentMeta?: {
      type?: string,
      bank?: string,
      va?: string,
      link?: string,
      expiredAt?: Date,
      gatewayResponse?: any,
      paidAt?: Date
    }
  ): Promise<Payment> {
    // 1. Load Domain Entity dari Repository
    const payment = await this.repo.findByOrderId(orderId);
    if (!payment) {
      throw new Error(`Payment not found: ${orderId}`);
    }

    // 2. Idempotency Check: Jika status sudah sama, tidak perlu melakukan apa-apa
    if (payment.getStatus() === newStatus) {
      return payment;
    }

    // 3. Eksekusi Domain Method sesuai status (Ubiquitous Language)
    switch (newStatus) {
      case PaymentStatus.PAID:
        payment.complete(paymentMeta?.paidAt, paymentMeta?.gatewayResponse);
        break;
      case PaymentStatus.FAILED:
        payment.fail(paymentMeta?.gatewayResponse);
        break;
      case PaymentStatus.EXPIRED:
        payment.expire();
        break;
      case PaymentStatus.CANCELLED:
        payment.cancel();
        break;
      case PaymentStatus.REFUNDED:
        payment.refund(paymentMeta?.gatewayResponse);
        break;
      default:
        // Jika status yang dikirim tidak didukung untuk diupdate manual (misal: kembali ke PENDING)
        throw new Error(`Manual transition to ${newStatus} is not allowed`);
    }

    // Update metadata tambahan jika ada
    if (paymentMeta) {
      payment.updateGatewayMeta({
        type: paymentMeta.type,
        bank: paymentMeta.bank,
        va: paymentMeta.va,
        link: paymentMeta.link,
        expiredAt: paymentMeta.expiredAt
      });
    }

    // 3. Simpan Perubahan (Transaction Boundary di akhir method)
    await this.repo.save(payment);

    // 4. Publikasi Event Update Status
    await this.publisher.publishPaymentUpdated(orderId, newStatus);

    return payment;
  }

  /**
   * Use Case: Membatalkan pembayaran secara manual
   */
  async cancelPayment(orderId: string): Promise<Payment> {
    const payment = await this.repo.findByOrderId(orderId);
    if (!payment) {
      throw new Error(`Payment not found: ${orderId}`);
    }

    if (payment.getStatus() !== PaymentStatus.PENDING) {
      throw new Error(`Cannot cancel payment with status ${payment.getStatus()}`);
    }

    // Call gateway to invalidate payment link
    const gateway = PaymentGatewayFactory.create(payment.gateway);
    await gateway.cancel(orderId);

    return await this.updatePaymentStatus(orderId, PaymentStatus.CANCELLED);
  }

  /**
   * Use Case: Menandai pembayaran sebagai kadaluarsa
   */
  async expirePayment(orderId: string): Promise<Payment> {
    const payment = await this.repo.findByOrderId(orderId);
    if (!payment) {
      throw new Error(`Payment not found: ${orderId}`);
    }

    if (payment.getStatus() !== PaymentStatus.PENDING) {
      throw new Error(`Cannot expire payment with status ${payment.getStatus()}`);
    }

    // Since Midtrans doesn't have an explicit 'expire', we use 'cancel' to kill the link
    const gateway = PaymentGatewayFactory.create(payment.gateway);
    await gateway.cancel(orderId);

    return await this.updatePaymentStatus(orderId, PaymentStatus.EXPIRED);
  }

  /**
   * Use Case: Mendapatkan detail pembayaran tunggal
   */
  async getPaymentByOrderId(orderId: string): Promise<Payment | null> {
    return await this.repo.findByOrderId(orderId);
  }

  /**
   * Use Case: Mendapatkan daftar pembayaran dengan filtrasi
   */
  async getAllPayments(options?: {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
  }) {
    return await this.repo.findAllWithCount(options);
  }
}
