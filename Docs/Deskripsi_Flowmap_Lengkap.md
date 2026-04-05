# Deskripsi Alur Flowmap Sistem Pembayaran (Lengkap)

Dokumen ini memetakan simbol-simbol dalam diagram *flowmap* dengan **Label (Nama Isi Box)** dan fungsinya agar tidak tertukar antara simbol yang serupa.

---

## Tabel Alur Flowmap Detail (Simbol & Label)

| No | Komponen Asal | Simbol Asal (Label) | Komponen Tujuan | Simbol Tujuan (Label) | Penjelasan Alur |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Website** | **Terminator (START)** | **Website** | **Keyboard (Registrasi Pendaftaran Event)** | User memulai pendaftaran event secara online. |
| 2 | **Website** | **Keyboard (Registrasi...)** | **Website** | **Dokumen (Data Registrasi)** | Input user menghasilkan dokumen registrasi awal. |
| 3 | **Website** | **Dokumen (Data Reg.)** | **Website** | **Dokumen (Data Pendaftaran)** | Data diproses menjadi dokumen pendaftaran siap bayar. |
| 4 | **Website** | **Dokumen (Data Pend.)** | **Website** | **Proses (Proses Pembayaran)** | Klik bayar memicu permintaan data ke server backend. |
| 5 | **Website** | **Proses (Proses Pemb.)** | **Hono-App** | **Proses (Validasi Data Pembayaran)** | Request dikirim ke API Hono untuk divalidasi. |
| 6 | **Hono-App** | **Proses (Validasi...)** | **Hono-App** | **Keputusan (Valid ?)** | Sistem melakukan pengecekan kebenaran data (YA/TIDAK). |
| 7 | **Hono-App** | **Keputusan (Valid ?)** | **Website** | **Dokumen (Error/Gagal)** | Alur **TIDAK**: Menampilkan layar error kepada user. |
| 8 | **Hono-App** | **Keputusan (Valid ?)** | **Hono-App** | **Harddisk (Simpan Awal: Pending)** | Alur **YA**: Menyimpan transaksi ke database MySQL. |
| 9 | **Hono-App** | **Harddisk (Simpan...)** | **Hono-App** | **Proses (Proses Antrian: Rabbitmq)** | Mengirimkan ID transaksi ke kanal pesan asinkron. |
| 10 | **Hono-App** | **Proses (Antrian)** | **Website** | **Dokumen (Response 201 Created)** | API memberikan respons sukses sementara ke frontend. |
| 11 | **Website** | **Dokumen (Resp. 201)** | **Website** | **Dokumen (Detail Pembayaran)** | Website mengarahkan user ke tampilan rincian order/order id. |
| 12 | **Hono-App** | **Proses (Antrian)** | **Hono-App** | **Proses (Worker)** | Antrean RabbitMQ diambil oleh komponen Worker. |
| 13 | **Hono-App** | **Proses (Worker)** | **Hono-App** | **Proses (Request Ke Link...)** | Worker menyiapkan permintaan ke API Midtrans. |
| 14 | **Hono-App** | **Proses (Request...)** | **Midtrans** | **Proses (Terima Req & Gen Link/VA)** | Gateway memproses request dan men-generate link. |
| 15 | **Midtrans** | **Proses (Terima Req)** | **Midtrans** | **Dokumen (Kirim Response Link/VA)** | Link pembayaran dikirim balik sebagai hasil (Output). |
| 16 | **Midtrans** | **Dokumen (Kirim Resp)** | **Hono-App** | **Proses (Worker)** | Worker menerima link pembayaran (Return flow). |
| 17 | **Hono-App** | **Proses (Worker)** | **Hono-App** | **Harddisk (Simpan Awal: Pending)** | Link disimpan/diupdate ke database agar status siap bayar. |
| 18 | **Website** | **Dokumen (Detail...)** | **Hono-App** | **Harddisk (Simpan Awal: Pending)** | Deteksi awal status `PENDING` untuk menampilkan link lama/VA. |
| 19 | **Website** | **Dokumen (Detail...)** | **Website** | **Proses (Pengecekan Status Berkala)** | Halaman detail memicu proses polling otomatis. |
| 20 | **Website** | **Proses (Polling)** | **Hono-App** | **Harddisk (Simpan Awal: Pending)** | Polling mengecek update status di database secara berkala. |
| 21 | **Website** | **Proses (Polling)** | **Website** | **Dokumen (c)** | Jika status di DB sudah sukses, tampilkan halaman akhir. |

---

## Singkatan Simbol:
- **Terminator**: Oval (Mulai/Selesai).
- **Keyboard**: Sisi atas miring (Input manual).
- **Proses**: Persegi (Komputasi sistem).
- **Dokumen**: Bawah bergelombang (Output/Tampilan).
- **Harddisk**: Silinder (Baca/Tulis Database).
- **Keputusan**: Belah Ketupat (Pengecekan logika).
