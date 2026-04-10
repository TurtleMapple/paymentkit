import { defineConfig } from '@mikro-orm/mysql';
import { getDbConfig } from './config/db';

export default defineConfig(getDbConfig() as any);
