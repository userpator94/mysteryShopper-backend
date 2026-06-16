import { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 3;

const requestCounts = new Map<string, { count: number; resetTime: number }>();

function getClientKey(req: Request): string {
  return `ip:${req.ip || 'unknown'}`;
}

export function authEmailRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const clientId = getClientKey(req);
  const now = Date.now();
  const clientData = requestCounts.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    requestCounts.set(clientId, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  if (clientData.count >= MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Слишком много запросов. Попробуйте позже.',
        statusCode: 429
      }
    });
    return;
  }

  clientData.count++;
  next();
}

/** Test helper */
export function resetAuthEmailRateLimiterForTests(): void {
  requestCounts.clear();
}
