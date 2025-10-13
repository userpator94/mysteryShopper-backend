import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiResponse, ApiErrorResponse } from '../types';
import { dbService } from '../services/databaseService';

export const getUserStatistics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    
    // Получаем статистику пользователя из представления user_statistics
    const userStats = await dbService.getUserStatistics(userId);
    
    if (!userStats) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'USER_STATISTICS_NOT_FOUND',
          message: 'Статистика пользователя не найдена'
        }
      };
      res.status(404).json(response);
      return;
    }
    
    const response: ApiResponse = {
      success: true,
      data: userStats
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ошибка при загрузке статистики пользователя'
      }
    };
    res.status(500).json(response);
  }
};
