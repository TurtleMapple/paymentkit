import { PaymentGateway } from './IPaymentGateway';
import { MidtransPaymentGateway } from './MidtransPaymentGateway';

/**
 * PAYMENT GATEWAY FACTORY
 * 
 * Bayangkan ini sebagai "Resepsionis" atau "Pintu Utama" untuk semua vendor pembayaran.
 * Aplikasi Anda tidak perlu tahu cara membuat 'Midtrans' atau 'Stripe' secara manual.
 * Cukup panggil Factory ini, dan dia akan memberikannya untuk Anda.
 * 
 * Memakai 2 Pola Desain (Design Pattern):
 * 1. Factory Pattern: Memisahkan logika pembuatan objek dari logika bisnis.
 * 2. Singleton Pattern: Memastikan kita tidak membuat objek yang sama berulang-ulang (Hemat Memori).
 */
export class PaymentGatewayFactory {
  
  // Map ini berfungsi sebagai "Gudang Penyimpanan" (Cache).
  // Jika kita sudah pernah membuat Midtrans, kita simpan di sini agar bisa dipakai lagi nanti.
  private static instances: Map<string, PaymentGateway> = new Map();

  /**
   * Fungsi untuk mendapatkan atau membuat instance gateway.
   * @param gatewayName Nama vendor (contoh: 'midtrans', 'xendit')
   */
  static create(gatewayName: string): PaymentGateway {
    // Kita ubah jadi huruf kecil semua agar tidak sensitif (contoh: 'Midtrans' jadi 'midtrans')
    const name = gatewayName.toLowerCase();

    // LANGKAH 1: Cek di "Gudang" (Cache)
    // Jika sudah ada di memori, langsung kasih saja yang sudah ada. Jangan buat baru lagi.
    if (this.instances.has(name)) {
      return this.instances.get(name)!;
    }

    let gateway: PaymentGateway;

    // LANGKAH 2: Jika belum ada di gudang, kita buatkan yang baru sesuai merek (vendor).
    switch (name) {
      case 'midtrans':
        gateway = new MidtransPaymentGateway();
        break;
      
      // Keuntungan Factory: Besok kalau mau tambah 'Xendit', kita cukup tambah satu baris 'case' di sini.
      // Sisa kode aplikasi Anda yang lain tidak perlu diubah sama sekali.
      
      default:
        // Jika minta vendor yang tidak kita dukung, kita langsung "protes" (Error).
        throw new Error(`Gateway '${gatewayName}' belum didukung oleh sistem kami.`);
    }

    // LANGKAH 3: Simpan objek yang baru dibuat tadi ke dalam "Gudang" (Map) untuk penggunaan berikutnya.
    this.instances.set(name, gateway);
    
    return gateway;
  }
}
