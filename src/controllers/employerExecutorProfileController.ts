import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiErrorResponse } from '../types';
import { dbService } from '../services/databaseService';

export const getEmployerExecutorProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const employerId = req.employerId!;
    const { offerId, executorUserId } = req.params;

    if (!offerId || !executorUserId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Укажите задачу и исполнителя' }
      } as ApiErrorResponse);
      return;
    }

    const data = await dbService.getEmployerExecutorProfile(employerId, offerId, executorUserId);
    if (!data) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Профиль недоступен' }
      } as ApiErrorResponse);
      return;
    }

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('getEmployerExecutorProfile:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при загрузке профиля' }
    } as ApiErrorResponse);
  }
};
