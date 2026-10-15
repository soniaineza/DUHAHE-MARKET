import rateLimit from 'express-rate-limit';

/**
 * Brute-force protection for auth endpoints (admin login, customer OTP flows).
 *
 * Sliding window per IP:
 *  - 10 auth attempts per 10 minutes is generous for a human,
 *    but makes online guessing of the admin password impractical.
 *
 * Uses a trusting proxy setup (Render terminates TLS in front of the app) so
 * req.ip is the real client IP from X-Forwarded-For. Never raise `limit`
 * without also considering the password strength.
 */
const limiterFactory = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

export function authRateLimit(req: Parameters<typeof limiterFactory>[0], res: Parameters<typeof limiterFactory>[1], next: Parameters<typeof limiterFactory>[2]) {
  return limiterFactory(req, res, next);
}

/**
 * Baseline flood protection for the whole API (scraping, abuse, brute force
 * amplification beyond the auth-specific limiter above).
 * 300 requests/minute per IP is far above any legitimate app usage but caps
 * how fast a single actor can hammer the service. Webhooks (Paypack retries
 * from provider IPs) and health checks are excluded.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => {
    const url = req.originalUrl ?? '';
    return url.startsWith('/api/webhooks') || url.startsWith('/api/health');
  },
  message: { error: 'Too many requests. Please slow down.' },
});

export function apiRateLimit(req: Parameters<typeof apiLimiter>[0], res: Parameters<typeof apiLimiter>[1], next: Parameters<typeof apiLimiter>[2]) {
  return apiLimiter(req, res, next);
}
