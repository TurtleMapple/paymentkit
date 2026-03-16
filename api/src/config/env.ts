import { config } from 'dotenv';
import path from 'path';

// Load .env.test if in test environment, otherwise load default .env
if (process.env.NODE_ENV === 'test') {
  config({ path: path.resolve(process.cwd(), '.env.test') });
} else {
  config();
}
import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('paymentkit'),
  DATABASE_URL: z.string().optional(),

  // RabbitMQ
  RABBITMQ_ENABLED: z.preprocess((val) => val !== 'false', z.boolean()).default(true),
  RABBITMQ_URL: z.string().default('amqp://localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().default('payment.exchange'),
  RABBITMQ_QUEUE: z.string().default('payment.created'),

  // Midtrans
  MIDTRANS_SERVER_KEY: z.string().min(1, 'MIDTRANS_SERVER_KEY is required'),
  MIDTRANS_CLIENT_KEY: z.string().min(1, 'MIDTRANS_CLIENT_KEY is required'),
  MIDTRANS_IS_PRODUCTION: z.preprocess((val) => val === 'true', z.boolean()).default(false),

  // API
  API_KEY: z.string().min(1, 'API_KEY is required'),

  // Logging
  LOG_LEVEL: z.enum(['info', 'success', 'error', 'debug', 'warn']).default('info'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const env = parsedEnv.data;
