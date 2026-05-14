import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiErrorResponse } from '../types';
import { dbService } from '../services/databaseService';
import { withReportApiFields } from '../utils/reportStatus';

export const getMyOfferReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { offerId } = req.params;

    const row = await dbService.getExecutorOwnReport(userId, offerId);
    if (!row) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Отчёт не найден' }
      };
      res.status(404).json(response);
      return;
    }

    res.status(200).json({ success: true, data: withReportApiFields(row as Record<string, unknown>) });
  } catch (error: any) {
    console.error('getMyOfferReport:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при загрузке отчёта' }
    };
    res.status(500).json(response);
  }
};
