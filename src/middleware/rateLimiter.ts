import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// Simple in-memory rate limiter (for production, consider using Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const isProduction = process.env.NODE_ENV === 'production';
const RATE_LIMIT_MAX_REQUESTS = isProduction ? 100 : 2000;

/** Profile endpoint — skip global limit (called on every app load). */
function isProfileMeRequest(req: Request): boolean {
  if (req.method !== 'GET') return false;
  const pathOnly = req.originalUrl.split('?')[0].replace(/\/$/, '') || '/';
  return pathOnly === '/api/me' || pathOnly.endsWith('/api/me');
}

function getRateLimitKey(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, config.jwt.secret) as {
        user_id?: string;
      };
      if (decoded.user_id) {
        return `user:${decoded.user_id}`;
      }
    } catch {
      /* fall through to IP */
    }
  }
  return `ip:${req.ip || 'unknown'}`;
}

export const rateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!isProduction) {
    return next();
  }

  if (isProfileMeRequest(req)) {
    return next();
  }

  const clientId = getRateLimitKey(req);
  const now = Date.now();

  const clientData = requestCounts.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    requestCounts.set(clientId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return next();
  }

  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests, please try again later',
        statusCode: 429,
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      }
    });
    return;
  }

  clientData.count++;
  next();
};
