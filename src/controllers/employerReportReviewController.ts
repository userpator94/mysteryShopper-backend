import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiErrorResponse } from '../types';
import { reportService } from '../services/reportService';
import { dbService } from '../services/databaseService';
import { withReportApiFields } from '../utils/reportStatus';

/** PATCH /api/offers/:offerId/reports/:reportId/review */
export const patchReportReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const employerId = req.employerId!;
    const employerUserId = req.userId!;
    const { offerId, reportId } = req.params;
    const { decision, comment } = req.body as { decision?: string; comment?: string | null };

    if (decision !== 'approve' && decision !== 'reject') {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Поле decision должно быть approve или reject' }
      } as ApiErrorResponse);
      return;
    }

    const owned = await dbService.isOfferOwnedByEmployer(offerId, employerId);
    if (!owned) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Нет доступа к этой задаче' }
      } as ApiErrorResponse);
      return;
    }

    await reportService.reviewReport({
      employerUserId,
      employerId,
      offerId,
      reportId,
      decision,
      comment: comment ?? null
    });

    const row = await dbService.getEmployerOfferReportById(employerId, offerId, reportId);
    if (!row) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Отчёт не найден' }
      } as ApiErrorResponse);
      return;
    }

    res.status(200).json({
      success: true,
      data: withReportApiFields(row as Record<string, unknown>)
    });
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg === 'REPORT_NOT_FOUND') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Отчёт не найден' }
      } as ApiErrorResponse);
      return;
    }
    if (msg === 'REJECT_COMMENT_MIN_WORDS') {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Комментарий при отклонении обязателен и должен содержать не менее 10 слов'
        }
      } as ApiErrorResponse);
      return;
    }
    if (msg === 'REJECT_NOT_ALLOWED_PAID') {
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Нельзя отклонить уже принятый отчёт' }
      } as ApiErrorResponse);
      return;
    }
    if (msg === 'APPROVE_NOT_ALLOWED_REJECTED') {
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Нельзя принять отчёт после отклонения' }
      } as ApiErrorResponse);
      return;
    }
    console.error('patchReportReview:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при сохранении решения по отчёту' }
    } as ApiErrorResponse);
  }
};
