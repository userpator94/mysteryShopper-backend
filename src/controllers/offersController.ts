import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiErrorResponse } from '../types';
import { dbService } from '../services/databaseService';

export const createOffer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const employerId = req.employerId!;
    const raw = req.body as Record<string, unknown>;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const start_date = raw.start_date;
    const end_date = raw.end_date;
    const max_participants = Number(raw.max_participants);
    const price =
      raw.price !== undefined && raw.price !== null && raw.price !== ''
        ? Number(raw.price)
        : 0;
    const priceNumber: number = Number.isNaN(price) || price < 0 ? 0 : price;

    if (!title || !start_date || !end_date || (max_participants !== 0 && Number.isNaN(max_participants))) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Обязательные поля: title, start_date, end_date, max_participants',
          field: 'body'
        }
      };
      res.status(422).json(response);
      return;
    }

    const startDate = new Date(String(start_date));
    const endDate = new Date(String(end_date));
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Дата окончания должна быть позже даты начала'
        }
      };
      res.status(422).json(response);
      return;
    }

    const tagsRaw = raw.tags;
    const tags: string[] = Array.isArray(tagsRaw)
      ? tagsRaw.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean)
      : typeof tagsRaw === 'string' && tagsRaw
        ? tagsRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    const offer = await dbService.createOffer({
      employer_id: employerId,
      title,
      description: typeof raw.description === 'string' ? raw.description.trim() : undefined,
      price: priceNumber,
      location: typeof raw.location === 'string' ? raw.location.trim() : undefined,
      requirements: typeof raw.requirements === 'string' ? raw.requirements.trim() : undefined,
      tags: tags.length ? tags : undefined,
      start_date: startDate,
      end_date: endDate,
      max_participants: Math.max(0, Number.isNaN(max_participants) ? 0 : max_participants),
      is_promo: Boolean(raw.is_promo),
      image_id: typeof raw.image_id === 'string' ? raw.image_id : undefined
    });

    res.status(201).json({ success: true, data: offer });
  } catch (error: any) {
    console.error('Error creating offer:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' ? error?.message : 'Ошибка при создании задачи'
      }
    };
    res.status(500).json(response);
  }
};

export const getMyOffers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const employerId = req.employerId!;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 20));

    const { rows, total } = await dbService.getOffersByEmployerId(employerId, { page, limit });

    res.status(200).json({
      success: true,
      data: rows,
      meta: { page, limit, total }
    });
  } catch (error: any) {
    console.error('Error fetching my offers:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Ошибка при получении списка задач'
      }
    };
    res.status(500).json(response);
  }
};

export const updateOffer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const employerId = req.employerId!;

    const isOwner = await dbService.isOfferOwnedByEmployer(id, employerId);
    if (!isOwner) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Нет прав на редактирование этой задачи' }
      };
      res.status(403).json(response);
      return;
    }

    const body = req.body as Record<string, unknown>;
    const allowed: (keyof typeof body)[] = [
      'title', 'description', 'price', 'location', 'requirements', 'tags',
      'start_date', 'end_date', 'max_participants', 'is_promo', 'is_active'
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    if (updates.start_date) updates.start_date = new Date(updates.start_date as string);
    if (updates.end_date) updates.end_date = new Date(updates.end_date as string);

    const offer = await dbService.updateOffer(id, updates as any);
    if (!offer) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Задача не найдена' }
      };
      res.status(404).json(response);
      return;
    }

    res.status(200).json({ success: true, data: offer });
  } catch (error: any) {
    console.error('Error updating offer:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' ? error?.message : 'Ошибка при обновлении задачи'
      }
    };
    res.status(500).json(response);
  }
};

export const deleteOffer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const employerId = req.employerId!;

    const isOwner = await dbService.isOfferOwnedByEmployer(id, employerId);
    if (!isOwner) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Нет прав на удаление этой задачи' }
      };
      res.status(403).json(response);
      return;
    }

    const soft = req.query.soft !== 'false';
    const deleted = await dbService.deleteOffer(id, soft);
    if (!deleted) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Задача не найдена' }
      };
      res.status(404).json(response);
      return;
    }

    res.status(200).json({ success: true, data: { message: soft ? 'Задача деактивирована' : 'Задача удалена' } });
  } catch (error: any) {
    console.error('Error deleting offer:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' ? error?.message : 'Ошибка при удалении задачи'
      }
    };
    res.status(500).json(response);
  }
};
