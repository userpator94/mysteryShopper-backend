import { Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { dbService } from '../services/databaseService';
import { ApiErrorResponse } from '../types';
import { AuthenticatedRequest } from './userIdValidator';

export interface JWTPayload {
  user_id: string;
  email?: string;
  role?: string;
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
      
      // Добавляем userId, email и role в request
      req.userId = decoded.user_id;
      req.userEmail = decoded.email;
      req.userRole = decoded.role || 'user';
      
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

/**
 * Middleware: доступ только для роли employer.
 * Роль берётся из JWT; расшифрованный JWT проверяется по таблице users (user_id и role должны совпадать с БД).
 * Затем связь с employers по user_id, employerId подставляется в request.
 */
export const requireEmployer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const tokenRole = req.userRole;

    const user = await dbService.getUserById(userId);
    if (!user) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Пользователь не найден'
        }
      };
      res.status(403).json(response);
      return;
    }
    if (!user.is_active) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Пользователь неактивен'
        }
      };
      res.status(403).json(response);
      return;
    }
    if (user.role !== 'employer') {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Доступ разрешён только заказчикам'
        }
      };
      res.status(403).json(response);
      return;
    }
    if (tokenRole !== undefined && tokenRole !== user.role) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Роль в токене не совпадает с ролью в базе данных'
        }
      };
      res.status(403).json(response);
      return;
    }

    const employerId = await dbService.getEmployerIdByUserId(userId);
    if (!employerId) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Профиль заказчика не найден'
        }
      };
      res.status(403).json(response);
      return;
    }
    req.employerId = employerId;
    next();
  } catch (error: any) {
    console.error('Error in requireEmployer:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Ошибка при проверке прав'
      }
    };
    res.status(500).json(response);
  }
};

