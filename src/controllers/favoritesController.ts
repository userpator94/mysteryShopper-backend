import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiResponse, FavoriteOffer, ApiErrorResponse, AddFavoriteRequest, AddFavoriteResponse, RemoveFavoriteResponse } from '../types';
import { favoritesService } from '../services/favoritesService';

export const getFavorites = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { offer_id } = req.query;
    
    // Если указан offer_id, проверяем конкретное предложение
    if (offer_id) {
      const isFavorite = await favoritesService.isOfferInFavorites(userId, offer_id as string);
      
      const response: ApiResponse<{ offer_id: string; is_favorite: boolean }> = {
        success: true,
        data: {
          offer_id: offer_id as string,
          is_favorite: isFavorite
        }
      };
      
      res.json(response);
      return;
    }
    
    // Если offer_id не указан, возвращаем все избранные предложения
    const favorites = await favoritesService.getUserFavorites(userId);
    
    // Проверяем, есть ли записи в избранном
    if (favorites.length === 0) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'FAVORITES_NOT_FOUND',
          message: 'У пользователя нет избранных предложений'
        }
      };
      res.status(404).json(response);
      return;
    }
    
    const response: ApiResponse<FavoriteOffer[]> = {
      success: true,
      data: favorites
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ошибка при загрузке избранного'
      }
    };
    res.status(500).json(response);
  }
};

export const addFavorite = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { offer_id }: AddFavoriteRequest = req.body;
    
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

    const result = await favoritesService.addToFavorites(userId, offer_id);
    
    const response: AddFavoriteResponse = {
      success: true,
      data: {
        offer_id,
        message: result.message
      }
    };
    
    // Возвращаем 201 для новых добавлений, 200 для уже существующих
    const statusCode = result.added ? 201 : 200;
    res.status(statusCode).json(response);
  } catch (error: any) {
    console.error('Error adding favorite:', error);
    
    if (error instanceof Error && error.message === 'OFFER_NOT_FOUND') {
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
    
    if (error instanceof Error && error.message === 'TABLE_NOT_FOUND') {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'TABLE_NOT_FOUND',
          message: 'Таблица избранного не найдена'
        }
      };
      res.status(500).json(response);
      return;
    }
    
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ошибка при добавлении в избранное'
      }
    };
    res.status(500).json(response);
  }
};

export const removeFavorite = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { offerId } = req.params;
    
    if (!offerId) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Не указан offerId'
        }
      };
      res.status(400).json(response);
      return;
    }

    const result = await favoritesService.removeFromFavorites(userId, offerId);
    
    const response: RemoveFavoriteResponse = {
      success: true,
      data: {
        offer_id: offerId,
        message: result.message
      }
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error removing favorite:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ошибка при удалении из избранного'
      }
    };
    res.status(500).json(response);
  }
};
