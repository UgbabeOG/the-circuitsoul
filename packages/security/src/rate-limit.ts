type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type RateLimiterOptions = {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
};

class MemoryRateLimiter {
  private stores: Map<string, { count: number; resetAt: number }> = new Map();

  check(key: string, options: RateLimiterOptions): RateLimitResult {
    const now = Date.now();
    const entry = this.stores.get(key);
    if (!entry || now > entry.resetAt) {
      this.stores.set(key, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, remaining: options.maxRequests - 1, resetAt: now + options.windowMs };
    }
    if (entry.count >= options.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }
    entry.count++;
    return { allowed: true, remaining: options.maxRequests - entry.count, resetAt: entry.resetAt };
  }

  reset(key: string): void {
    this.stores.delete(key);
  }
}

const memoryLimiter = new MemoryRateLimiter();

export function createRateLimiter(options: RateLimiterOptions) {
  const prefix = options.keyPrefix || 'rl';

  return {
    check(identifier: string): RateLimitResult {
      return memoryLimiter.check(`${prefix}:${identifier}`, options);
    },

    reset(identifier: string): void {
      memoryLimiter.reset(`${prefix}:${identifier}`);
    }
  };
}

export const rateLimiters = {
  signin: createRateLimiter({ windowMs: 60 * 1000, maxRequests: 10, keyPrefix: 'rl:signin' }),
  callback: createRateLimiter({ windowMs: 60 * 1000, maxRequests: 20, keyPrefix: 'rl:callback' }),
  publish: createRateLimiter({ windowMs: 60 * 1000, maxRequests: 30, keyPrefix: 'rl:publish' }),
  scan: createRateLimiter({ windowMs: 60 * 1000, maxRequests: 10, keyPrefix: 'rl:scan' }),
  optimize: createRateLimiter({ windowMs: 60 * 1000, maxRequests: 20, keyPrefix: 'rl:optimize' }),
  aiGeneration: createRateLimiter({ windowMs: 60 * 1000, maxRequests: 30, keyPrefix: 'rl:ai' }),
  general: createRateLimiter({ windowMs: 60 * 1000, maxRequests: 100, keyPrefix: 'rl:general' })
};

export { MemoryRateLimiter };
export type { RateLimitResult, RateLimiterOptions };
