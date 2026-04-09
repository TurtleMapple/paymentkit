# ─────────────────────────────────────────────────────
# STAGE 1: builder
# Tujuan : Menginstal semua dependensi dan mengkompilasi
#          TypeScript ke JavaScript.
# Catatan: Image ini TIDAK akan masuk ke production,
#          hanya digunakan sementara saat proses build.
# ─────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Tetapkan direktori kerja di dalam container
WORKDIR /app

# Install pnpm secara global, lalu bersihkan cache npm
RUN npm install -g pnpm && npm cache clean --force

# ── Strategi Cache Layer Docker ──
# Copy file manifest TERLEBIH DAHULU sebelum source code.
# Jika package.json dan lockfile tidak berubah,
# Docker akan menggunakan cache dari layer ini
# sehingga pnpm install tidak perlu dijalankan ulang.
COPY package.json pnpm-lock.yaml ./

# Install SEMUA dependensi (termasuk devDependencies untuk build TypeScript)
# --frozen-lockfile: memastikan lockfile tidak berubah (deterministik)
# pnpm store prune: membersihkan cache store pnpm agar layer lebih ringan
RUN pnpm install --frozen-lockfile && pnpm store prune

# Copy konfigurasi TypeScript (diperlukan untuk kompilasi)
COPY tsconfig.json ./

# Copy seluruh source code aplikasi
COPY src/ ./src/

# Kompilasi TypeScript → JavaScript
# Output akan berada di /app/dist/ (sesuai tsconfig.json: outDir: "dist")
RUN pnpm build


# ─────────────────────────────────────────────────────
# STAGE 2: runner
# Tujuan : Image production yang bersih dan minimal.
#          Hanya berisi JavaScript hasil kompilasi
#          dan production dependencies.
# ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Tetapkan direktori kerja
WORKDIR /app

# Install pnpm, lalu bersihkan cache npm
RUN npm install -g pnpm && npm cache clean --force

# ── Keamanan: Non-Root User ──
# Menjalankan aplikasi sebagai root adalah risiko keamanan.
# Kita membuat user dan group khusus bernama 'appuser'
# yang tidak memiliki hak akses sistem (non-privilese).
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy file manifest untuk install production deps
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install HANYA production dependencies
# (TypeScript, vitest, tsx, dan devDependencies lainnya TIDAK ikut)
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# Copy hasil kompilasi dari stage builder
COPY --from=builder /app/dist ./dist

# ── Dokumentasi Port ──
# Mendokumentasikan bahwa aplikasi menggunakan port 3000.
# Instruksi ini tidak membuka port, hanya sebagai dokumentasi.
EXPOSE 3000

# Alihkan kepemilikan semua file ke user appuser
RUN chown -R appuser:appgroup /app

# Jalankan aplikasi sebagai non-root user mulai dari sini
USER appuser

# ── Default Command ──
# Menjalankan HTTP server (Hono).
# Command ini bisa di-override di docker-compose.yml
# untuk menjalankan worker dengan command yang berbeda.
CMD ["node", "dist/server.js"]
