import pino from 'pino';
import { Request } from 'express';
import { BACKEND_VERSION } from '../config/appVersion';

const nodeEnv = process.env.NODE_ENV || 'development';

const REDACTED = '[REDACTED]';

const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'password_hash',
  'token',
  'authorization',
  'cookie',
  'set-cookie',
  'resend_api_key',
  'jwt_secret'
]);

export const logger = pino({
  level: process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug'),
  base: {
    service: 'mystery-shopper-backend',
    version: BACKEND_VERSION,
    env: nodeEnv
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label })
  },
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      '*.password',
      '*.token',
      '*.authorization',
      '*.password_hash',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]'
    ],
    censor: REDACTED
  }
});

export type Logger = pino.Logger;

export const getRequestLogger = (req: Request): Logger => {
  const withLogger = req as Request & { log?: Logger; id?: string | number };
  return withLogger.log ?? logger.child({ requestId: withLogger.id });
};

export const maskEmail = (email?: string | null): string | undefined => {
  if (!email || typeof email !== 'string') return undefined;
  const at = email.indexOf('@');
  if (at <= 0) return '[invalid-email]';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
};

export const sanitizeForLog = (value: unknown, depth = 0): unknown => {
  if (depth > 5) return '[depth-limit]';
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEYS.has(key.toLowerCase())
        ? REDACTED
        : sanitizeForLog(item, depth + 1);
    }
    return result;
  }
  return value;
};
