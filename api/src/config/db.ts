import { MikroORM, EntityCaseNamingStrategy, Options } from "@mikro-orm/core";
import { MySqlDriver } from "@mikro-orm/mysql";
import { Migrator } from "@mikro-orm/migrations";
import { Payment } from "../domain/entities/paymentEntity";
import { env } from "./env";
import { logger } from "../utils/logger";

export const getDbConfig = (): Options => {
  if (env.DATABASE_URL) {
    return {
      driver: MySqlDriver,
      clientUrl: env.DATABASE_URL,
      entities: [Payment],
      extensions: [Migrator],
      migrations: {
        path: './src/database/migrations',
        disableForeignKeys: false,
      },
      namingStrategy: EntityCaseNamingStrategy,
      debug: env.LOG_LEVEL === 'debug',
      pool: { min: 2, max: 10 },
    };
  }

  return {
    driver: MySqlDriver,
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    dbName: env.DB_NAME,
    entities: [Payment],
    extensions: [Migrator],
    migrations: {
      path: './src/database/migrations',
      disableForeignKeys: false,
    },
    namingStrategy: EntityCaseNamingStrategy,
    debug: env.LOG_LEVEL === 'debug',
    pool: { min: 2, max: 10 },
  };
};

export let orm: MikroORM;

export const initDatabase = async (): Promise<MikroORM> => {
  orm = await MikroORM.init(getDbConfig());
  return orm;
};

export const getEntityManager = () => {
  if (!orm) throw new Error('Database not initialized');
  return orm.em.fork();
};
