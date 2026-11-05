import * as crypto from 'crypto';

export class SecurityGateway {
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.GATEWAY_SECRET_KEY || 'circuitsoul_default_secret_key_9381';
  }

  generateSignature(payload: any, timestamp: number): string {
    const dataString = JSON.stringify(payload) + timestamp.toString();
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(dataString)
      .digest('hex');
  }

  validateRequest(payload: any, timestamp: number, signature: string): boolean {
    const currentTimestamp = Date.now();
    if (Math.abs(currentTimestamp - timestamp) > 5 * 60 * 1000) {
      return false;
    }
    const expectedSignature = this.generateSignature(payload, timestamp);

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  sanitizePayload<T>(input: T): T {
    if (typeof input === 'string') {
      return input.replace(/<[^>]*>/g, '').trim() as unknown as T;
    }
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizePayload(item)) as unknown as T;
    }
    if (input !== null && typeof input === 'object') {
      const sanitizedObj: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitizedObj[key] = this.sanitizePayload(value);
      }
      return sanitizedObj as T;
    }
    return input;
  }
}

export const securityGateway = new SecurityGateway();
