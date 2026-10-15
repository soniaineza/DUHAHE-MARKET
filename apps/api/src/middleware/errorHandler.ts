import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}

type HttpError = {
  type?: string;
  status?: number;
  statusCode?: number;
  message?: string;
};

/**
 * Central error handler.
 *  - body-parser failures become proper 400/413 responses (not silent 500s);
 *  - internal (5xx) messages are NEVER echoed to clients in production —
 *    raw error text can leak connection details (URI, hosts, drivers);
 *  - everything is logged server-side for debugging.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  console.error('[error]', req.method, req.originalUrl, err);
  const error = (err ?? {}) as HttpError;

  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body must be valid JSON' });
    return;
  }
  if (error.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body is too large' });
    return;
  }

  const status = typeof error.status === 'number' ? error.status : typeof error.statusCode === 'number' ? error.statusCode : 500;
  if (status >= 500) {
    const message = !config.isProduction && err instanceof Error ? err.message : 'Internal server error';
    res.status(status).json({ error: message });
    return;
  }
  res.status(status).json({ error: error.message ?? 'Request failed' });
}

export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
}