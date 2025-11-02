import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiResponse, ApplyRequest, ApplyResponse, ApiErrorResponse } from '../types';
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

