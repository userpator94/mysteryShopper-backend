import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApplyRequest, ApplyResponse, GetAppliesResponse, ApiErrorResponse } from '../types';
import { applyService } from '../services/applyService';
import { dbService } from '../services/databaseService';
import { countWordsInComment } from '../utils/reportStatus';

export const applyToOffer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { offer_id }: ApplyRequest = req.body;
    
    // Валидация входных данных
    if (!offer_id) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Не указан offer_id'
        }
      };
      res.status(400).json(response);
      return;
    }

    // Проверка существования предложения
    const offerExists = await applyService.isOfferExists(offer_id);
    
    if (!offerExists) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'OFFER_NOT_FOUND',
          message: 'Предложение не найдено'
        }
      };
      res.status(404).json(response);
      return;
    }

    const hasSlot = await dbService.offerHasFreeSlot(offer_id);
    if (!hasSlot) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'OFFER_FULL',
          message: 'Достигнут лимит исполнителей по этой задаче'
        }
      };
      res.status(409).json(response);
      return;
    }

    // Создание заявки
    const application = await applyService.createApplication(userId, offer_id);
    await dbService.updateOfferParticipants(offer_id);
    
    const response: ApplyResponse = {
      success: true,
      data: application
    };
    
    res.status(201).json(response);
  } catch (error: any) {
    console.error('Error creating application:', error);
    
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ошибка при создании заявки'
      }
    };
    res.status(500).json(response);
  }
};

export const getApplies = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { offer_id } = req.query;

    // Если указан offer_id, возвращаем заявку по конкретному предложению
    if (offer_id) {
      const application = await applyService.getUserApplicationByOfferId(userId, offer_id as string);
      
      if (!application) {
        const response: ApiErrorResponse = {
          success: false,
          error: {
            code: 'APPLICATION_NOT_FOUND',
            message: 'Заявка на данное предложение не найдена'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: GetAppliesResponse = {
        success: true,
        data: application
      };
      
      res.json(response);
      return;
    }

    // Если offer_id не указан, возвращаем все заявки пользователя
    const [applications, cancelled_count] = await Promise.all([
      applyService.getUserApplications(userId),
      applyService.countUserCancelledApplications(userId)
    ]);

    const response: GetAppliesResponse = {
      success: true,
      data: applications,
      meta: { cancelled_count }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching applications:', error);
    
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ошибка при получении заявок'
      }
    };
    res.status(500).json(response);
  }
};

/** GET /api/offers/:id/applications — список заявок по офферу (только владелец оффера — employer) */
export const getOfferApplications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const offerId = req.params.id;
    const employerId = req.employerId!;

    const isOwner = await dbService.isOfferOwnedByEmployer(offerId, employerId);
    if (!isOwner) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Нет прав на просмотр заявок этой задачи' }
      };
      res.status(403).json(response);
      return;
    }

    const offer = await dbService.getOfferById(offerId);
    if (!offer) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Задача не найдена' }
      };
      res.status(404).json(response);
      return;
    }

    const applications = await applyService.getApplicationsByOfferId(offerId);
    res.status(200).json({ success: true, data: applications });
  } catch (error: any) {
    console.error('Error fetching offer applications:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при получении заявок' }
    };
    res.status(500).json(response);
  }
};

/** PATCH /api/applications/:id — смена статуса заявки (approved | rejected), только владелец оффера */
export const patchApplicationStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const applicationId = req.params.id;
    const { status, comment } = req.body as { status?: string; comment?: string };
    const employerId = req.employerId!;
    const employerUserId = req.userId!;

    if (!status || !['approved', 'rejected'].includes(status)) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'status должен быть "approved" или "rejected"' }
      };
      res.status(422).json(response);
      return;
    }

    if (status === 'rejected') {
      const c = typeof comment === 'string' ? comment.trim() : '';
      if (countWordsInComment(c) < 10) {
        const response: ApiErrorResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'При отклонении заявки укажите комментарий не короче 10 слов'
          }
        };
        res.status(422).json(response);
        return;
      }
    }

    const application = await applyService.getApplicationById(applicationId);
    if (!application) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Заявка не найдена' }
      };
      res.status(404).json(response);
      return;
    }

    const isOwner = await dbService.isOfferOwnedByEmployer(application.offer_id, employerId);
    if (!isOwner) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Нет прав на изменение этой заявки' }
      };
      res.status(403).json(response);
      return;
    }

    const updated = await applyService.updateApplicationStatus(applicationId, status as 'approved' | 'rejected', {
      employerUserId: status === 'approved' ? employerUserId : undefined,
      decisionComment: status === 'rejected' ? String(comment || '').trim() : undefined
    });
    if (updated?.offer_id) {
      await dbService.updateOfferParticipants(updated.offer_id);
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating application status:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при обновлении заявки' }
    };
    res.status(500).json(response);
  }
};

export const cancelApplication = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { offer_id } = req.query;

    // Валидация входных данных
    if (!offer_id) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Не указан offer_id'
        }
      };
      res.status(400).json(response);
      return;
    }

    // Отмена заявки
    const application = await applyService.cancelApplication(userId, offer_id as string);

    if (!application) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'Заявка на данное предложение не найдена'
        }
      };
      res.status(404).json(response);
      return;
    }

    await dbService.updateOfferParticipants(application.offer_id);

    const response: ApplyResponse = {
      success: true,
      data: application
    };
    
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error cancelling application:', error);
    
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ошибка при отмене заявки'
      }
    };
    res.status(500).json(response);
  }
};

