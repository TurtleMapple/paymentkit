# Deskripsi Standar Unit Testing

Dokumen ini mendefinisikan standar dan praktik terbaik untuk penulisan Unit Test di proyek **PaymentKit**. Unit testing adalah fondasi dari piramida pengujian kita, yang bertujuan untuk memverifikasi unit terkecil dari kode (fungsi atau class) secara terisolasi.

## 1. Tujuan Unit Testing
- **Kepercayaan Diri**: Memastikan perubahan kode tidak merusak fitur yang sudah ada (mencegah regresi).
- **Dokumentasi**: Bertindak sebagai dokumentasi hidup tentang bagaimana modul seharusnya bekerja.
- **Desain Kode**: Mendorong penulisan kode yang lebih modular dan mudah diuji (testable).

## 2. Metodologi Pengujian
Kita menggunakan dua pendekatan utama dalam pengujian:
- **Black Box Testing**: Menguji input dan output tanpa melihat struktur kode internal. Fokus pada pemenuhan requirement.
- **White Box Testing**: Menguji alur logika dan struktur internal kode (seperti loop, conditional, dan branch).

> [!IMPORTANT]
> **Tugas AI Agent**: Sebelum memulai pembuatan Unit Test, AI Agent **WAJIB** mempertanyakan kepada User metode mana yang ingin digunakan (Black Box atau White Box) agar pengujian sesuai dengan kebutuhan spesifik.

## 3. Test Driven Development (TDD)
Kita menerapkan siklus TDD dengan metode **Red Flag** dan **Green Flag**:
1.  **Red Flag (Fail)**: Buat skenario pengujian terlebih dahulu (terutama skenario error/sad path). Jalankan test dan pastikan test tersebut gagal.
2.  **Green Flag (Pass)**: Tulis kode minimal yang diperlukan agar test tersebut berhasil (happy path).
3.  **Refactor**: Perbaiki struktur kode tanpa mengubah fungsionalitas, dengan tetap menjaga indikator test tetap "Green".

## 4. Panduan: Apa yang Wajib Masuk Unit Test?
Tidak semua baris kode harus dites secara mendalam, namun komponen berikut bersifat **Wajib**:
- **Public Interface**: Bagian fungsi atau metode yang bisa dipanggil oleh bagian lain dari aplikasi (Public API).
- **Logika Bisnis yang Kompleks (Core Logic)**: Kode yang mengandung perhitungan, manipulasi data, atau pengambilan keputusan kritis (contoh: fungsi menghitung diskon belanja atau pajak).
- **Jalur Percabangan (Conditional Paths)**: Tempat di mana bug sering bersembunyi.
    - Gunakan **Happy Path** (input normal/sukses).
    - Gunakan **Sad Path** (input salah/error).
    - Uji **Edge Cases** (nilai batas, input kosong, dsb).

## 5. Tools & Framework
- **Test Runner**: [Vitest](https://vitest.dev/) (cepat, kompatibel dengan Vite/TS).
- **Assertion Library**: Built-in Vitest (chai-compatible).
- **Mocking**: Vitest `vi` (untuk mocking dependencies seperti database atau API eksternal).

## 6. Struktur Pengujian (AAA Pattern)
Setiap test case harus mengikuti pola **Arrange, Act, Assert**:
1.  **Arrange**: Siapkan data input dan kondisi yang diperlukan (termasuk mocking).
2.  **Act**: Panggil fungsi atau metode yang sedang diuji.
3.  **Assert**: Verifikasi bahwa output atau efek samping sesuai dengan ekspektasi.

## 7. Prinsip FIRST
Unit test yang baik harus memenuhi prinsip:
- **Fast**: Harus berjalan sangat cepat (milidetik).
- **Isolated**: Tidak bergantung pada database asli, file system, atau test lain. Gunakan mocking untuk dependensi.
- **Repeatable**: Memberikan hasil yang sama setiap kali dijalankan.
- **Self-Validating**: Test harus lulus atau gagal secara otomatis tanpa inspeksi manual.
- **Timely**: Ditulis bersamaan dengan kode melalui proses TDD.

## 8. Konvensi Penamaan & Lokasi
- **Lokasi**: File test diletakkan di dalam sub-folder `Test/` pada modul terkait.
- **Nama File**: Menggunakan suffix `.test.ts`. Contoh: `payment.service.test.ts`.
- **Deskripsi Test**: Gunakan blok `describe` untuk nama unit dan `it` atau `test` untuk perilaku spesifik dalam kalimat yang jelas.

## 9. Cakupan (Coverage)
Target cakupan kode untuk logika bisnis utama (Services & Utils) adalah **minimal 80%**. Laporan cakupan dapat dibuat dengan menjalankan perintah `pnpm test:coverage`.
