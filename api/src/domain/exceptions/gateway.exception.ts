/**
 * Base custom error untuk semua error yang berasal dari Payment Gateway
 */
export class BaseGatewayException extends Error {
  constructor(message: string, public readonly originalError?: any) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown ketika terjadi kesalahan pada validasi (cth: parameter kurang, tipe data salah)
 * yang dikembalikan oleh vendor.
 */
export class GatewayValidationException extends BaseGatewayException {
  constructor(message: string, originalError?: any) {
    super(message, originalError);
  }
}

/**
 * Thrown ketika kredensial (API Key / Server Key) ditolak oleh vendor.
 */
export class GatewayAuthException extends BaseGatewayException {
  constructor(message: string = 'Authentication failed with payment gateway', originalError?: any) {
    super(message, originalError);
  }
}

/**
 * Thrown ketika vendor tidak membalas / server vendor down.
 */
export class GatewayTimeoutException extends BaseGatewayException {
  constructor(message: string = 'Payment gateway timeout or unavailable', originalError?: any) {
    super(message, originalError);
  }
}
