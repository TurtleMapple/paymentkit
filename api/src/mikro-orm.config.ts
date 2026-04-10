import { defineConfig } from '@mikro-orm/mysql';
import { getDbConfig } from './src/config/db';

export default defineConfig(getDbConfig() as any);
