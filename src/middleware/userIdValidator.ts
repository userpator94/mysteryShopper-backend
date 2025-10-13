import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse } from '../types';
import { dbService } from '../services/databaseService';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const validateUserId = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.get('X-User-Id');
  
  if (!userId) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'X-User-Id header is required'
      }
    };
    res.status(400).json(response);
    return;
  }
  
  try {
    // Проверяем существование пользователя в базе данных
    const userExists = await dbService.isUserExists(userId);
    
    if (!userExists) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Пользователь с указанным ID не найден'
        }
      };
      res.status(404).json(response);
      return;
    }
    
    req.userId = userId;
    next();
  } catch (error) {
    console.error('Error validating user:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ошибка при проверке пользователя'
      }
    };
    res.status(500).json(response);
  }
};
