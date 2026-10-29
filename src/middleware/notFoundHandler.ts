import { Request, Response, NextFunction } from 'express';
import { getAllowedOrigins, isOriginAllowed } from '../config/cors';
import { getRequestLogger } from '../utils/logger';

/**
 * Если preflight дошёл сюда (редко: прокси/CORS), не отдаём JSON 404 — иначе браузер показывает тело ответа на OPTIONS.
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (req.method === 'OPTIONS') {
    const requestOrigin = req.headers.origin;
    if (typeof requestOrigin === 'string' && isOriginAllowed(requestOrigin, getAllowedOrigins())) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    const reqHdr = req.headers['access-control-request-headers'];
    if (reqHdr) {
      res.setHeader('Access-Control-Allow-Headers', reqHdr);
    } else {
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }
    res.setHeader('Content-Length', '0');
    res.status(204).end();
    return;
  }

  if (req.originalUrl.startsWith('/api')) {
    getRequestLogger(req).warn({
      event: 'http.not_found',
      method: req.method,
      url: req.originalUrl
    }, 'API route not found');
  }

  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.originalUrl} not found`,
      statusCode: 404
    }
  });
};
