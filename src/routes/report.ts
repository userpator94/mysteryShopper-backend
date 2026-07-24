import { Router, Request, Response, NextFunction } from 'express';
import { createReport } from '../controllers/reportController';
import { authenticateJWT } from '../middleware/authMiddleware';
import { parseReportMultipart } from '../middleware/reportMultipartParser';
import { AppError } from '../middleware/errorHandler';
import { ApiErrorResponse } from '../types';

const router = Router();

// Применяем middleware для проверки JWT токена ко всем маршрутам
router.use(authenticateJWT);

// Middleware для обработки ошибок multipart-парсера
const handleMultipartError = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  if (!err) {
    next();
    return;
  }

  if (err.statusCode === 413) {
    res.status(413).json({
      success: false,
      error: {
        code: 'FILE_UPLOAD_ERROR',
        message: err.message || 'Общий размер вложений превышает 15 МБ. Уменьшите размер или количество фото.'
      }
    } as ApiErrorResponse);
    return;
  }

  if (err.message === 'MULTIPART_BOUNDARY_MISSING') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Некорректный multipart-запрос (нет boundary). Проверьте прокси и Content-Type.'
      }
    } as ApiErrorResponse);
    return;
  }

  res.status(400).json({
    success: false,
    error: {
      code: 'FILE_UPLOAD_ERROR',
      message: err.message || 'Ошибка при загрузке файла'
    }
  } as ApiErrorResponse);
};

// POST /api/report - создать отчет с загрузкой фотографий
// Используется multipart/form-data для загрузки файлов
// Файлы сохраняются в таблицу images (бинарники в поле report_file типа BYTEA)
// ID изображений сохраняются в поле photos таблицы offer_reports (массив ID в JSON)
// Поля: application_id, offer_id, user_id, rating, feedback (JSON string), photos (массив файлов)
router.post(
  '/',
  parseReportMultipart,
  handleMultipartError,
  createReport
);

export default router;
