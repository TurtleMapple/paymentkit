/**
 * Utility untuk menyensor data sensitif sebelum di-log.
 */

const SENSITIVE_KEYS = [
  'email',
  'phone',
  'authorization',
  'password',
  'server_key',
  'client_key',
  'token',
];

export function maskSensitiveData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Jika berupa array, proses setiap elemen
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }

  // Jika berupa objek murni, clone dan masking key-nya
  if (typeof data === 'object') {
    const maskedObj: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
        maskedObj[key] = '***[MASKED]***';
      } else if (typeof value === 'object') {
        maskedObj[key] = maskSensitiveData(value);
      } else {
        maskedObj[key] = value;
      }
    }
    return maskedObj;
  }

  return data;
}
