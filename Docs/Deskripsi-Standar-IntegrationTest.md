# Deskripsi Standar Integration Testing

Dokumen ini mendefinisikan standar dan praktik terbaik untuk penulisan **Integration Test** di proyek **PaymentKit**. Integration Test menggabungkan modul-modul internal dan menguji komunikasinya dengan layanan eksternal (Database, API Pihak Ketiga, dsb).

## 1. Tujuan Integration Testing
- **Koneksi Eksternal**: Memastikan fungsi internal (seperti Register) sudah bisa berkomunikasi dengan eksternal (Database/API) dengan benar.
- **Integritas Alur**: Memastikan berbagai komponen bekerja sama sesuai alur bisnis tanpa ada data yang "hilang" di tengah jalan.
- **Validasi Infrastruktur**: Memverifikasi interaksi nyata dengan Database (MikroORM) dan RabbitMQ.

## 2. Hal-hal yang Diperiksa
- **Interface Integrity (Antarmuka)**: Apakah Module A mengirimkan data dalam format yang dimengerti Module B?
- **External Connectivity (Koneksi Luar)**: Mengetes koneksi asli ke Database, API pihak ketiga (seperti Payment Gateway), atau File System.
- **Data Flow (Aliran Data)**: Memastikan data tetap konsisten dan tidak berubah tidak semestinya di sepanjang alur.
- **Error Handling Across Modules**: Memastikan pesan kesalahan diteruskan dengan benar antar modul hingga ke pengguna.

## 3. Cakupan Integrasi (Scope)
Meskipun Handler, Service, dan Repository adalah fokus utama, Integration Test juga merambat ke ranah lain:
- **Middleware & Routing**: Memastikan *Auth*, *Validation*, dan *Error fHandler* bekerja saat dipanggil melalui route.
- **Message Broker (RabbitMQ)**: Menguji komunikasi antara modul internal dengan antrean (queue) dan Worker.
- **Third-Party APIs**: Menguji interaksi dengan layanan luar seperti Midtrans (Gateway Pembayaran).
- **Database Migrations**: Memastikan skema database nyata sudah sesuai dengan ekspektasi kode.

## 4. Strategi Integration Testing
Terdapat 4 strategi utama yang bisa digunakan:
1.  **Sandwich (Hybrid)**: Menguji dari dua arah (atas dan bawah) secara bersamaan hingga bertemu di lapisan tengah (Logika Bisnis). *Sering digunakan oleh tim pengembang.*
2.  **Top-Down**: Dimulai dari modul tingkat atas (UI/User Interaction) menuju modul pendukung (Database/Teknis) menggunakan *Stubs* tetapi bila database tidak bisa di mock atau sudah tersedia maka menggunakan database asli.
3.  **Bottom-Up**: Dimulai dari modul tingkat rendah (Low-level/Pekerjaan Berat seperti query DB) menuju modul tingkat tinggi (UI Dashboard) menggunakan *Drivers*.
4.  **Big Bang**: Menggabungkan semua modul sekaligus (A-Z). Kurang fleksibel karena pengujian tidak bisa dimulai sebelum semua modul selesai.

## 5. Stubs & Drivers
Kode tambahan (dummy) yang dibuat khusus untuk keperluan testing:
- **Stubs (Penerima Pasif)**: Digunakan dalam Top-Down. Memberikan respon yang sudah disiapkan untuk modul di atasnya.
    - *Contoh*: Stub Database memberikan jawaban "User Ada" untuk mengetes modul Login tanpa database asli.
- **Drivers (Alat Penembak)**: Digunakan dalam Bottom-Up. Bertugas memanggil modul bawah, memberi input, dan memantau hasilnya.
    - *Contoh*: Driver Payment memanggil modul Payment Gateway untuk mengetes integrasi sebelum halaman Checkout selesai.

## 6. Metodologi: Gray Box Testing
Kita menggunakan pendekatan **Gray Box Testing**:
- Memiliki pengetahuan tentang struktur internal (seperti skema database).
- Pengujian dilakukan melalui interface publik (API) namun tetap memantau perubahan status di level internal database.

## 7. Tools & Framework
- **Test Runner**: [Vitest](https://vitest.dev/).
- **API Testing**: Hono `app.request()` atau alat eksternal dalam skrip test (seperti Postman/cURL).
- **Database**: Menggunakan database terpisah (isolated) untuk pengujian.
- **Mocking External**: `nock`/`msw` untuk mensimulasikan respons API pihak ketiga jika koneksi asli tidak memungkinkan.

## 8. Manajemen State Database
1.  **Setup**: Jalankan migrasi terbaru sebelum pengujian.
2.  **Isolasi**: Gunakan transaksi atau pembersihan data (cleanup) setelah setiap test case.
3.  **Teardown**: Tutup semua koneksi infrastruktur setelah selesai.

> [!IMPORTANT]
> **Tugas AI Agent**: Saat membuat Integration Test, pastikan konfigurasi tambahan (seperti URL Database khusus Test) sudah benar agar tidak mengganggu environment Development atau Production.
