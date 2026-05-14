import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiErrorResponse } from '../types';
import { dbService } from '../services/databaseService';

/** GET /api/offers/:offerId/employer-summary — публичные данные заказчика для исполнителя с заявкой */
export const getOfferEmployerSummaryForExecutor = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId!;
    const { offerId } = req.params;

    if (!offerId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Укажите задачу' }
      } as ApiErrorResponse);
      return;
    }

    const me = await dbService.getUserById(userId);
    if (!me || me.role !== 'user') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Доступно только исполнителям' }
      } as ApiErrorResponse);
      return;
    }

    const data = await dbService.getEmployerPublicSummaryForOffer(userId, offerId);
    if (!data) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Нет доступа к данным заказчика по этой задаче' }
      } as ApiErrorResponse);
      return;
    }

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('getOfferEmployerSummaryForExecutor:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при загрузке данных заказчика' }
    } as ApiErrorResponse);
  }
};
