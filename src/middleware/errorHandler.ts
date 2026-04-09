import { Request, Response, NextFunction } from 'express';

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

  // Детальное логирование ошибки
  console.error('🚨 ERROR OCCURRED:');
  console.error(`   Timestamp: ${timestamp}`);
  console.error(`   Status Code: ${statusCode}`);
  console.error(`   Message: ${message}`);
  console.error(`   URL: ${req.method} ${req.url}`);
  console.error(`   IP: ${req.ip}`);
  console.error(`   User Agent: ${req.get('User-Agent')}`);
  console.error('   Stack Trace:', err.stack);
  
  // Логирование тела запроса для POST/PUT запросов
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    console.error('   Request Body:', JSON.stringify(req.body, null, 2));
  }

  // Логирование параметров запроса
  if (Object.keys(req.params).length > 0) {
    console.error('   Params:', req.params);
  }
  
  if (Object.keys(req.query).length > 0) {
    console.error('   Query:', req.query);
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
