import { PaymentStatus } from '../entities/paymentStatus';
import { Payment } from '../entities/paymentEntity';
import { IPaymentRepository } from '../repositories/IPaymentRepository';
import { IPaymentEventPublisher } from './IPaymentEventPublisher';

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
   * Use Case: Membuat pembayaran baru
   */
  async createPayment(
    orderId: string,
    amount: number,
    gateway: string,
    customerName?: string,
    customerEmail?: string
  ): Promise<Payment> {
    // 1. Cek duplikasi (Business Side Rule)
    const existing = await this.repo.findByOrderId(orderId);
    if (existing) {
      throw new Error('Order ID already exists');
    }

    // 2. Inisialisasi Domain Entity via Static Factory
    const payment = Payment.create(orderId, amount, gateway);
    payment.customerName = customerName;
    payment.customerEmail = customerEmail;

    // 3. Persistensi ke Database
    await this.repo.save(payment);

    // 4. Publikasi Event Kesuksesan (Explicit Orchestration)
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
