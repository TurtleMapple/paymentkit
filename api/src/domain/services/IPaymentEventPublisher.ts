import { PaymentStatus } from '../entities/paymentStatus';

/**
 * PAYMENT EVENT PUBLISHER (Interface / Kontrak)
 * 
 * DESKRIPSI UNTUK DEVELOPER:
 * File ini memang sengaja dibuat ringkas karena ini adalah "KONTRAK" (Interface).
 * 
 * FILOSOFI DESAIN:
 * Kita menggunakan prinsip Dependency Inversion (SOLID). 
 * Domain Service (Logic Bisnis) tidak boleh peduli apakah kita mengirim pesan lewat:
 * - RabbitMQ (Antrian)
 * - Redis Pub/Sub
 * - Kafka
 * - Atau bahkan cuma console.log (untuk testing)
 * 
 * MANFAAT:
 * 1. Decoupling: Logic bisnis tidak terikat ke teknologi antrian tertentu.
 * 2. Testability: Kita bisa membuat "MockPublisher" dengan mudah saat testing tanpa perlu menyalakan RabbitMQ asli.
 */
export interface IPaymentEventPublisher {
  /**
   * Mengirim sinyal ke sistem lain bahwa pembayaran baru saja dibuat (PENDING).
   * Biasanya digunakan untuk memicu proses pembuatan link di sisi vendor secara asinkron.
   */
  publishPaymentCreated(orderId: string): Promise<void>;

  /**
   * Mengirim sinyal bahwa status pembayaran telah berubah (contoh: PAID, FAILED, EXPIRED).
   * Berguna untuk sistem notifikasi (Email/WA) atau sinkronisasi ke modul stok/inventori.
   */
  publishPaymentUpdated(orderId: string, status: PaymentStatus): Promise<void>;
}
