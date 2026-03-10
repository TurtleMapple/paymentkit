import { Context, Next } from 'hono';
import { env } from '../config/env';

export const apiKeyAuth = async (c: Context, next: Next) => {
  const apiKey = c.req.header('x-api-key');

  // amazonq-ignore-next-line
  // amazonq-ignore-next-line
  if (!apiKey || apiKey !== env.API_KEY) {
    return c.json({ error: 'Unauthorized', message: 'Invalid or missing API key' }, 401);
  }

  await next();
};
