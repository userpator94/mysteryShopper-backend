import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { ApiErrorResponse } from '../types';
import { AuthenticatedRequest } from './userIdValidator';

export interface JWTPayload {
  user_id: string;
  email?: string;
  iat?: number;
  exp?: number;
}

/**
 * Middleware для аутентификации по JWT токену
 * Извлекает токен из заголовка Authorization: Bearer <token>
 * Верифицирует токен и добавляет userId в request
 */
export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Получаем токен из заголовка Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Токен авторизации не предоставлен'
        }
      };
      res.status(401).json(response);
      return;
    }

    // Формат: "Bearer <token>"
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Неверный формат токена. Ожидается: Bearer <token>'
        }
      };
      res.status(401).json(response);
      return;
    }

    const token = parts[1];

    try {
      // Верифицируем токен
      const decoded = authService.verifyToken(token) as JWTPayload;
      
      // Проверяем наличие user_id в токене
      if (!decoded.user_id) {
        const response: ApiErrorResponse = {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Неверный или истекший токен'
          }
        };
        res.status(401).json(response);
        return;
      }
      
      // Добавляем userId и email в request
      req.userId = decoded.user_id;
      req.userEmail = decoded.email;
      
      next();
    } catch (error: any) {
      // Определяем тип ошибки
      let errorCode = 'INVALID_TOKEN';
      let errorMessage = 'Неверный или истекший токен';
      
      if (error.message === 'jwt expired') {
        errorCode = 'TOKEN_EXPIRED';
        errorMessage = 'Токен авторизации истек';
      } else if (error.message === 'Invalid token' || error.message === 'Token not active') {
        errorCode = 'INVALID_TOKEN';
        errorMessage = 'Неверный или истекший токен';
      }
      
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage
        }
      };
      res.status(401).json(response);
      return;
    }
  } catch (error: any) {
    console.error('Error in authenticateJWT:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Ошибка при проверке авторизации'
      }
    };
    res.status(500).json(response);
  }
};

