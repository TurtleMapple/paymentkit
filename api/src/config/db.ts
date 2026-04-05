import { MikroORM, EntityCaseNamingStrategy, Options } from "@mikro-orm/core";
import { MySqlDriver } from "@mikro-orm/mysql";
import { Migrator } from "@mikro-orm/migrations";
import { Payment } from "../domain/entities/paymentEntity";
import { env } from "./env";

/**
 * FUNGSI PEMBANTU: KONFIGURASI DATABASE
 * Fungsi ini mengembalikan objek konfigurasi yang diperlukan oleh MikroORM.
 * Kita membagi opsi konfigurasi menjadi "Umum" dan "Spesifik" (DRY).
 */
export const getDbConfig = (): Options => {
  // Opsi Umum: Berlaku untuk koneksi lokal maupun Cloud/Production
  const commonOptions: Options = {
    driver: MySqlDriver,
    entities: [Payment], // List semua Entity (Tabel) yang kita miliki
    extensions: [Migrator], // Aktifkan fitur Migrasi (Auto-update database)
    migrations: {
      path: './src/database/migrations',
      pathTs: './src/database/migrations',
      disableForeignKeys: false,
      transactional: true, // Pastikan migrasi aman jika gagal tengah jalan
    },
    namingStrategy: EntityCaseNamingStrategy, // Ubah properti camelCase jadi snake_case di database
    debug: env.LOG_LEVEL === 'debug', // Aktifkan query logging jika level log adalah "debug"
    pool: { min: 2, max: 10 }, // Kelola koneksi agar SQL tidak tumbang (Max 10 koneksi paralel)
  };

  /**
   * KASUS A: KONEKSI PRODUKSI (DATABASE_URL)
   * Dipakai di infrastruktur modern (seperti Docker, Heroku, Railway, VPS)
   */
  if (env.DATABASE_URL) {
    return {
      ...commonOptions,
      clientUrl: env.DATABASE_URL,
    };
  }

  /**
   * KASUS B: KONEKSI STANDAR (LOKAL/XPAMP/DOCKER LOKAL)
   * Dipakai saat dev menggunakan kombinasi Host, Port, User, Password.
   */
  return {
    ...commonOptions,
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    dbName: env.DB_NAME,
  };
};

/**
 * VARIABLE ORM GLOBAL (SINGLETON-ISH)
 * Kita menyimpan instance ORM di sini agar bisa digunakan di seluruh aplikasi.
 */
export let orm: MikroORM;

/**
 * INISIALISASI DATABASE
 * Dipanggil di server startup (index.ts/app.ts) untuk menyalakan koneksi.
 */
export const initDatabase = async (): Promise<MikroORM> => {
  orm = await MikroORM.init(getDbConfig());
  return orm;
};

/**
 * EM FORK (KEAMANAN TRANSAKSI)
 * Alih-alih pakai satu em global, kita selalu melakukan .fork() 
 * agar antar-request HTTP tidak saling bertabrakan datanya (Identity Map Isolation).
 */
export const getEntityManager = () => {
  if (!orm) throw new Error('Database not initialized');
  return orm.em.fork();
};
