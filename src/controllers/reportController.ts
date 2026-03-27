import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiErrorResponse, ReportResponse } from '../types';
import { reportService } from '../services/reportService';
import { dbService } from '../services/databaseService';
import fs from 'fs';

export const createReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    let bodyData: any = {};
    if (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)) {
      bodyData = req.body;
    } else if (typeof req.body === 'string') {
      try {
        bodyData = JSON.parse(req.body);
      } catch {
        bodyData = req.body;
      }
    }

    let feedback: Record<string, any> = {};
    if (bodyData.feedback !== undefined && bodyData.feedback !== null) {
      if (typeof bodyData.feedback === 'string') {
        try {
          feedback = JSON.parse(bodyData.feedback);
        } catch {
          feedback = { comment: bodyData.feedback };
        }
      } else if (typeof bodyData.feedback === 'object' && !Array.isArray(bodyData.feedback)) {
        feedback = bodyData.feedback as Record<string, any>;
      }
    }

    let checklistAnswers: Record<string, unknown> | null = null;
    if (bodyData.checklist_answers !== undefined && bodyData.checklist_answers !== null) {
      if (typeof bodyData.checklist_answers === 'string') {
        try {
          checklistAnswers = JSON.parse(bodyData.checklist_answers);
        } catch {
          checklistAnswers = null;
        }
      } else if (typeof bodyData.checklist_answers === 'object') {
        checklistAnswers = bodyData.checklist_answers as Record<string, unknown>;
      }
    }

    const { application_id, offer_id, user_id } = bodyData;
    const jwtUserId = req.userId;

    if (!application_id || !offer_id || !user_id) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Обязательны поля: application_id, offer_id, user_id'
        }
      };
      res.status(400).json(response);
      return;
    }

    if (jwtUserId !== user_id) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'FORBIDDEN', message: 'user_id не совпадает с авторизованным пользователем' }
      };
      res.status(403).json(response);
      return;
    }

    const appOk = await dbService.verifyApplicationForUser(application_id, user_id, offer_id);
    if (!appOk) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Заявка не найдена или не принадлежит пользователю' }
      };
      res.status(403).json(response);
      return;
    }

    const ratingRaw = bodyData.rating;
    const ratingNum =
      ratingRaw === undefined || ratingRaw === null || ratingRaw === ''
        ? null
        : typeof ratingRaw === 'string'
          ? parseInt(ratingRaw, 10)
          : Number(ratingRaw);

    if (ratingRaw !== undefined && ratingRaw !== null && ratingRaw !== '') {
      if (
        ratingNum === null ||
        Number.isNaN(ratingNum as number) ||
        !Number.isInteger(ratingNum as number) ||
        (ratingNum as number) < 1 ||
        (ratingNum as number) > 5
      ) {
        const response: ApiErrorResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'rating должен быть целым числом от 1 до 5 (или не передаваться для чек-листа)'
          }
        };
        res.status(400).json(response);
        return;
      }
    }

    if (checklistAnswers === null && (typeof feedback !== 'object' || feedback === null || Array.isArray(feedback))) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'feedback должен быть объектом JSON'
        }
      };
      res.status(400).json(response);
      return;
    }

    const photoFiles: Array<{
      filename: string;
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }> = [];

    const files = req.files;
    const fileArray: Express.Multer.File[] = Array.isArray(files)
      ? files
      : files
        ? Object.values(files).flat()
        : [];

    if (fileArray.length > 0) {
      for (const file of fileArray) {
        let buffer: Buffer;
        if (file.buffer) {
          buffer = file.buffer;
        } else if (file.path) {
          buffer = fs.readFileSync(file.path);
          fs.unlinkSync(file.path);
        } else {
          continue;
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = file.originalname.split('.').pop() || '';
        const basename = file.originalname.replace(/\.[^/.]+$/, '');
        const filename = `${basename}-${uniqueSuffix}.${ext}`;

        photoFiles.push({
          filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer
        });
      }
    }

    const commentsText =
      typeof feedback.comment === 'string' ? feedback.comment.trim() : '';

    try {
      const report = await reportService.createReport({
        applicationId: application_id,
        offerId: offer_id,
        userId: user_id,
        rating: ratingNum as number | null,
        commentsText: commentsText || null,
        checklistAnswers,
        photoFiles
      });

      const response: ReportResponse = {
        success: true,
        data: {
          report_id: report.report_id,
          application_id: report.application_id,
          offer_id: report.offer_id,
          user_id: report.user_id,
          rating: report.rating as number,
          feedback: report.feedback as Record<string, any>,
          photos: report.photos,
          created_at: (report.submitted_at as Date).toISOString()
        }
      };

      res.status(201).json(response);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg === 'REPORT_ALREADY_EXISTS') {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Отчёт по этой заявке уже отправлен. Повторная отправка недоступна.'
          }
        } as ApiErrorResponse);
        return;
      }
      if (msg === 'OFFER_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Задание не найдено' }
        } as ApiErrorResponse);
        return;
      }
      if (msg.startsWith('SCHEMA_ERROR:')) {
        res.status(422).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: msg.replace('SCHEMA_ERROR:', '') }
        } as ApiErrorResponse);
        return;
      }
      if (msg.startsWith('VALIDATION:')) {
        const parts = msg.split(':');
        const message = parts[1] || 'Ошибка валидации';
        const field = parts[2] || undefined;
        res.status(422).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message, field }
        } as ApiErrorResponse);
        return;
      }
      if (
        msg === 'CHECKLIST_ANSWERS_REQUIRED' ||
        msg === 'RATING_REQUIRED' ||
        msg === 'COMMENT_REQUIRED' ||
        msg === 'NO_PHOTOS_WITH_CHECKLIST'
      ) {
        const human: Record<string, string> = {
          CHECKLIST_ANSWERS_REQUIRED: 'Для этого задания нужны ответы по чек-листу',
          RATING_REQUIRED: 'Укажите оценку от 1 до 5',
          COMMENT_REQUIRED: 'Заполните текстовый комментарий к отчёту',
          NO_PHOTOS_WITH_CHECKLIST: 'Для отчёта по чек-листу фотографии не принимаются'
        };
        res.status(422).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: human[msg] || msg }
        } as ApiErrorResponse);
        return;
      }
      throw err;
    }
  } catch (error: any) {
    console.error('Error creating report:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Ошибка при создании отчета'
      }
    };
    res.status(500).json(response);
  }
};
