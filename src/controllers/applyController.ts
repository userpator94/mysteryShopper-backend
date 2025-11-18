import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiResponse, ApplyRequest, ApplyResponse, GetAppliesResponse, ApiErrorResponse } from '../types';
import { applyService } from '../services/applyService';

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

    // Создание заявки
    const application = await applyService.createApplication(userId, offer_id);
    
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
    const applications = await applyService.getUserApplications(userId);
    
    const response: GetAppliesResponse = {
      success: true,
      data: applications
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

