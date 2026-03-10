import { Context } from 'hono';
import { ZodError } from 'zod';

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof ZodError) {
    const errors = err.issues.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));

    return c.json({
      success: false,
      message: 'Validation failed',
      errors
    }, 400);
  }

  return c.json({
    success: false,
    // amazonq-ignore-next-line
    // amazonq-ignore-next-line
    message: err.message || 'Internal server error'
  }, 500);
};
