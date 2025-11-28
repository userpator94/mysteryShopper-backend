import { Router, Request, Response, NextFunction } from 'express';
import { createReport } from '../controllers/reportController';
import { authenticateJWT } from '../middleware/authMiddleware';
import { uploadReportPhotosToMemory } from '../middleware/uploadMiddleware';
import { ApiErrorResponse } from '../types';
import multer from 'multer';

const router = Router();

// Применяем middleware для проверки JWT токена ко всем маршрутам
router.use(authenticateJWT);

// Middleware для обработки ошибок multer
const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    let message = 'Ошибка при загрузке файла';
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Размер файла превышает 10MB';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Превышено максимальное количество файлов (10)';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Неожиданное поле для загрузки файла';
    }
    
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'FILE_UPLOAD_ERROR',
        message
      }
    };
    res.status(400).json(response);
    return;
  }
  
  if (err) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'FILE_UPLOAD_ERROR',
        message: err.message || 'Ошибка при загрузке файла'
      }
    };
    res.status(400).json(response);
    return;
  }
  
  next();
};

// POST /api/report - создать отчет с загрузкой фотографий
// Используется multipart/form-data для загрузки файлов
// Файлы сохраняются в таблицу images (бинарники в поле report_file типа BYTEA)
// ID изображений сохраняются в поле photos таблицы offer_reports (массив ID в JSON)
// Поля: application_id, offer_id, user_id, rating, feedback (JSON string), photos (массив файлов)
router.post(
  '/',
  uploadReportPhotosToMemory, // Используем memory storage для сохранения в БД
  handleMulterError,
  createReport
);

export default router;

