# Deskripsi Standar Git

Dokumen ini mendefinisikan standar dan praktik terbaik untuk penggunaan Git di proyek **PaymentKit**. Standar ini bertujuan untuk menjaga kebersihan riwayat commit, memudahkan kolaborasi, dan memastikan integritas kode.

## 1. Alur Kerja (Workflow)
Kita menggunakan model **Feature Branching**:
- **main**: Branch produksi yang selalu stabil dan siap dideploy.
- **development**: Branch integrasi fitur. Semua fitur baru digabungkan ke sini sebelum ke `main`.
- **feature/**: Branch untuk pengembangan fitur baru.
- **fix/**: Branch untuk perbaikan bug.
- **hotfix/**: Branch untuk perbaikan mendesak di `main`.

## 2. Konvensi Penamaan Branch
Nama branch harus deskriptif dan mengikuti format:
- `feature/<nama-fitur>` (contoh: `feature/payment-gateway-integration`)
- `fix/<issue-id-atau-deskripsi>` (contoh: `fix/error-handling-db`)
- `docs/<deskripsi>` (contoh: `docs/update-readme`)

## 3. Konvensi Commit Message
Kita mengikuti standar [Conventional Commits v1.0.0-beta.4](https://www.conventionalcommits.org/en/v1.0.0-beta.4/).

### Format Struktur
```text
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

### Elemen Struktural
- **type**: Menunjukkan kategori perubahan.
    - **feat**: Fitur baru (berkorelasi dengan **MINOR** di semantic versioning).
    - **fix**: Perbaikan bug (berkorelasi dengan **PATCH** di semantic versioning).
    - **docs**: Perubahan dokumentasi saja.
    - **style**: Perubahan formatting (white-space, formatting, missing semi-colons, dll).
    - **refactor**: Perubahan kode yang tidak memperbaiki bug atau menambah fitur.
    - **test**: Menambah atau memperbaiki test.
    - **chore**: Perubahan pada proses build atau alat bantu.
    - **perf**: Perubahan kode yang meningkatkan performa.
    - **improvement**: Meningkatkan implementasi saat ini tanpa menambah fitur atau memperbaiki bug.
- **scope**: (Opsional) Memberikan konteks tambahan tentang bagian yang berubah, diletakkan dalam tanda kurung, e.g., `feat(parser): add ability to parse arrays`.
- **description**: Ringkasan singkat tentang perubahan kode.
- **body**: (Opsional) Informasi kontekstual yang lebih detail. Harus dimulai satu baris kosong setelah deskripsi.
- **footer**: (Opsional) Berisi meta-informasi seperti Pull Request terkait, reviewer, atau Breaking Changes.
- **BREAKING CHANGE**: Indikasi perubahan yang merusak API. Harus ditulis dengan huruf besar **BREAKING CHANGE** di awal body atau footer. Bisa juga ditandai dengan tanda seru (`!`) sebelum titik dua pada prefix, e.g., `feat(api)!: change response format`.

### Contoh Commit
- **Fitur dengan Scope**: `feat(lang): add polish language`
- **Perbaikan Bug**: `fix: correct minor typos in code`
- **Breaking Change**: 
  ```text
  feat: allow provided config object to extend other configs

  BREAKING CHANGE: `extends` key in config file is now used for extending other config files
  ```
- **Breaking Change dengan Tanda Seru**: `chore!: drop Node 6 from testing matrix`

## 4. Proses Pull Request & Review
1.  Buat branch baru dari `development`.
2.  Lakukan commit secara atomik (satu perubahan spesifik per commit).
3.  Pastikan semua test lulus sebelum membuat Pull Request (PR).
4.  Setiap PR **WAJIB** direview oleh setidaknya satu anggota tim lain sebelum digabungkan.
5.  Gunakan deskripsi PR yang jelas tentang apa yang diubah dan cara memverifikasinya.

## 5. Strategi Penggabungan (Merge Strategy)
- Gunakan **Squash and Merge** saat menggabungkan feature branch ke development/main untuk menjaga riwayat commit tetap bersih.
- Pastikan branch tujuan selalu update dengan branch asal sebelum melakukan merge untuk menghindari konflik besar.

> [!IMPORTANT]
> **Tugas AI Agent**: AI Agent harus memastikan setiap commit yang dilakukan mengikuti format Conventional Commits dan berada pada branch yang sesuai dengan tugasnya.