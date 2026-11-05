import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

/**
 * Baseline response hardening for the JSON API:
 *  - nosniff: browsers must not guess content types (stops MIME sniffing);
 *  - no framing: the API serves no embeddable pages;
 *  - no referrer leakage;
 *  - HSTS in production (Render serves HTTPS);
 *  - X-Powered-By disabled (app.disable in app.ts) — reveals the stack.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Authenticated/auth responses must never be stored by browsers or proxies,
  // so Back/forward cannot resurrect another session's data.
  if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/auth')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // The admin dashboard on Vercel fetches this JSON cross-origin.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}
