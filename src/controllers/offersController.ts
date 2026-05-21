import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiErrorResponse } from '../types';
import { dbService } from '../services/databaseService';
import { MAX_PARTICIPANTS_UNLIMITED } from '../config/offerLimits';
import { parseChecklistSchema } from '../utils/checklistSchemaValidator';
import { parseLocationPoints } from '../utils/locationPointsValidator';

/**
 * Лимит: 1…998 или MAX_PARTICIPANTS_UNLIMITED (999) = без ограничения.
 * Поле не передано — по умолчанию 1.
 */
function parseMaxParticipantsForCreate(raw: unknown): { ok: true; value: number } | { ok: false; message: string } {
  if (raw === undefined) return { ok: true, value: 1 };
  if (raw === null || (typeof raw === 'string' && raw.trim() === '')) return { ok: true, value: 1 };
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isNaN(n) || !Number.isInteger(n)) {
    return { ok: false, message: 'max_participants: целое число 1–998 или 999 (без лимита)' };
  }
  if (n === MAX_PARTICIPANTS_UNLIMITED) return { ok: true, value: n };
  if (n >= 1 && n <= 998) return { ok: true, value: n };
  return {
    ok: false,
    message: `max_participants: от 1 до 998 или ${MAX_PARTICIPANTS_UNLIMITED} (без лимита)`
  };
}

function normalizeMaxParticipantsPatch(raw: unknown): { ok: true; value: number } | { ok: false; message: string } {
  if (raw === null || raw === undefined) {
    return { ok: false, message: 'max_participants: укажите целое число 1–998 или 999 (без лимита)' };
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isNaN(n) || !Number.isInteger(n)) {
    return { ok: false, message: 'max_participants: целое число 1–998 или 999 (без лимита)' };
  }
  if (n === MAX_PARTICIPANTS_UNLIMITED) return { ok: true, value: n };
  if (n >= 1 && n <= 998) return { ok: true, value: n };
  return {
    ok: false,
    message: `max_participants: от 1 до 998 или ${MAX_PARTICIPANTS_UNLIMITED} (без лимита)`
  };
}

export const createOffer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const employerId = req.employerId!;
    const raw = req.body as Record<string, unknown>;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const start_date = raw.start_date;
    const end_date = raw.end_date;
    const maxParsed = parseMaxParticipantsForCreate(raw.max_participants);
    if (!maxParsed.ok) {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: maxParsed.message }
      } as ApiErrorResponse);
      return;
    }
    const max_participants = maxParsed.value;
    const price =
      raw.price !== undefined && raw.price !== null && raw.price !== ''
        ? Number(raw.price)
        : 0;
    const priceNumber: number = Number.isNaN(price) || price < 0 ? 0 : price;

    if (!title || !start_date || !end_date) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Обязательные поля: title, start_date, end_date',
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

    let checklist_schema: unknown | null | undefined = undefined;
    if (raw.checklist_schema !== undefined) {
      const parsed = parseChecklistSchema(raw.checklist_schema);
      if (!parsed.ok) {
        res.status(422).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.message }
        } as ApiErrorResponse);
        return;
      }
      checklist_schema = parsed.schema;
    }

    let schema_version = 1;
    if (typeof raw.schema_version === 'number' && !Number.isNaN(raw.schema_version)) {
      schema_version = raw.schema_version;
    }

    let location_points: import('../utils/locationPointsValidator').LocationPoint[] | null = null;
    if (raw.location_points !== undefined) {
      const lp = parseLocationPoints(raw.location_points);
      if (!lp.ok) {
        res.status(422).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: lp.message }
        } as ApiErrorResponse);
        return;
      }
      location_points = lp.points;
    }

    const offer = await dbService.createOffer({
      employer_id: employerId,
      title,
      description: typeof raw.description === 'string' ? raw.description.trim() : undefined,
      price: priceNumber,
      location: typeof raw.location === 'string' ? raw.location.trim() : undefined,
      location_points,
      requirements: typeof raw.requirements === 'string' ? raw.requirements.trim() : undefined,
      tags: tags.length ? tags : undefined,
      start_date: startDate,
      end_date: endDate,
      max_participants,
      is_promo: Boolean(raw.is_promo),
      image_id: typeof raw.image_id === 'string' ? raw.image_id : undefined,
      checklist_schema: checklist_schema === undefined ? undefined : checklist_schema,
      schema_version
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
    const current = await dbService.getOfferById(id);
    if (!current) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Задача не найдена' }
      };
      res.status(404).json(response);
      return;
    }

    const editLocked = await dbService.offerEditLocked(id);
    if (editLocked) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'OFFER_EDIT_FORBIDDEN',
          message:
            'Редактирование недоступно: по задаче есть отчёт или заявка исполнителя в работе (принята, выполняется или завершена).'
        }
      };
      res.status(403).json(response);
      return;
    }

    if (body.location_points !== undefined) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Метки на карте задаются только при создании задачи'
        }
      } as ApiErrorResponse);
      return;
    }

    const allowed: (keyof typeof body)[] = [
      'title', 'description', 'price', 'location', 'requirements', 'tags',
      'start_date', 'end_date', 'max_participants', 'is_promo', 'is_active',
      'checklist_schema'
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    if (updates.start_date) updates.start_date = new Date(updates.start_date as string);
    if (updates.end_date) updates.end_date = new Date(updates.end_date as string);

    if (updates.checklist_schema !== undefined) {
      const parsed = parseChecklistSchema(updates.checklist_schema);
      if (!parsed.ok) {
        res.status(422).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.message }
        } as ApiErrorResponse);
        return;
      }
      const prevJson = JSON.stringify(current.checklist_schema ?? null);
      const nextJson = JSON.stringify(parsed.schema ?? null);
      updates.checklist_schema = parsed.schema;
      if (prevJson !== nextJson) {
        const ver = Number(current.schema_version) || 1;
        updates.schema_version = ver + 1;
      }
    }

    if (updates.max_participants !== undefined) {
      const mp = normalizeMaxParticipantsPatch(updates.max_participants);
      if (!mp.ok) {
        res.status(422).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: mp.message }
        } as ApiErrorResponse);
        return;
      }
      updates.max_participants = mp.value;
    }

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

/** POST /api/offers/:id/close-early — досрочное закрытие (только владелец). Идемпотентно. */
export const closeOfferEarly = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const employerId = req.employerId!;

    const isOwner = await dbService.isOfferOwnedByEmployer(id, employerId);
    if (!isOwner) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Нет прав на закрытие этой задачи' }
      };
      res.status(403).json(response);
      return;
    }

    const result = await dbService.closeOfferEarlyForEmployer(id, employerId);
    if (result.status === 'not_found') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Задача не найдена' }
      } as ApiErrorResponse);
      return;
    }
    if (result.status === 'already_ended') {
      res.status(422).json({
        success: false,
        error: { code: 'OFFER_PERIOD_ENDED', message: 'Срок задачи уже истёк' }
      } as ApiErrorResponse);
      return;
    }

    res.status(200).json({ success: true, data: result.offer });
  } catch (error: any) {
    console.error('Error closing offer early:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' ? error?.message : 'Ошибка при закрытии задачи'
      }
    };
    res.status(500).json(response);
  }
};
