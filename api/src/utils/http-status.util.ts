/**
 * Standard HTTP Status Codes
 * Digunakan untuk menggantikan *magic numbers* dalam handler dan response
 */
export const HttpStatus = {
  // 2xx Success
  OK: 200,
  CREATED: 201,

  // 4xx Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409, // Biasanya untuk data yang sudah ada (misal: Order ID sudah digunakan)

  // 5xx Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  GATEWAY_TIMEOUT: 504,
} as const;

// Ekspor tipe agar bisa digunakan untuk strict typing di Response Hono
export type HttpStatusCode = typeof HttpStatus[keyof typeof HttpStatus];
