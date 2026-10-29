import { Request, Response, NextFunction } from 'express';
import { getRequestLogger, sanitizeForLog } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const timestamp = new Date().toISOString();
  const log = getRequestLogger(req);

  const errorMeta: Record<string, unknown> = {
    event: 'http.error',
    statusCode,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as Request & { userId?: string }).userId,
    errorName: err.name,
    errorCode: (err as AppError & { code?: string }).code,
    isOperational: err.isOperational
  };

  // Тело запроса логируем только для мутирующих методов и с маскированием секретов
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    errorMeta.requestBody = sanitizeForLog(req.body);
  }
  if (Object.keys(req.params).length > 0) {
    errorMeta.params = sanitizeForLog(req.params);
  }
  if (Object.keys(req.query).length > 0) {
    errorMeta.query = sanitizeForLog(req.query);
  }

  if (statusCode >= 500) {
    log.error({ ...errorMeta, err }, message);
  } else {
    log.warn(errorMeta, message);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      timestamp,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        url: `${req.method} ${req.url}`,
        ip: req.ip
      })
    }
  });
};
