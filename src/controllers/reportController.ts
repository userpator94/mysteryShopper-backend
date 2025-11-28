import { Response, Request } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiErrorResponse, ReportRequest, ReportResponse } from '../types';
import { reportService } from '../services/reportService';
import fs from 'fs';

export const createReport = async (req: Request, res: Response): Promise<void> => {
  try {
    // Парсим JSON из поля body (если используется multipart/form-data)
    let bodyData: any = {};
    
    // Если body уже объект (application/json), используем его
    if (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)) {
      bodyData = req.body;
    } else if (typeof req.body === 'string') {
      // Если body строка (multipart/form-data), пытаемся распарсить
      try {
        bodyData = JSON.parse(req.body);
      } catch {
        // Если не JSON, значит поля переданы как form-data
        bodyData = req.body;
      }
    }

    // Парсим feedback, если он строка
    let feedback: Record<string, any>;
    if (typeof bodyData.feedback === 'string') {
      try {
        feedback = JSON.parse(bodyData.feedback);
      } catch {
        feedback = bodyData.feedback;
      }
    } else {
      feedback = bodyData.feedback;
    }

    const { application_id, offer_id, user_id, rating } = bodyData;
    
    // Валидация входных данных
    if (!application_id || !offer_id || !user_id || rating === undefined || !feedback) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Все поля обязательны: application_id, offer_id, user_id, rating, feedback'
        }
      };
      res.status(400).json(response);
      return;
    }

    // Проверка, что rating в допустимом диапазоне
    const ratingNum = typeof rating === 'string' ? parseInt(rating, 10) : rating;
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5 || !Number.isInteger(ratingNum)) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'rating должен быть целым числом от 1 до 5'
        }
      };
      res.status(400).json(response);
      return;
    }

    // Проверка, что feedback является объектом
    if (typeof feedback !== 'object' || feedback === null || Array.isArray(feedback)) {
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

    // Обработка загруженных файлов для сохранения в таблицу images
    const photoFiles: Array<{
      filename: string;
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }> = [];
    
    // Обрабатываем файлы из multer (могут быть массивом или объектом)
    const files = req.files;
    const fileArray: Express.Multer.File[] = Array.isArray(files) 
      ? files 
      : files 
        ? Object.values(files).flat() 
        : [];
    
    if (fileArray.length > 0) {
      for (const file of fileArray) {
        let buffer: Buffer;
        
        // Если файл в памяти (buffer), используем его напрямую
        if (file.buffer) {
          buffer = file.buffer;
        } else if (file.path) {
          // Если файл на диске, читаем его
          buffer = fs.readFileSync(file.path);
          // Удаляем файл с диска, так как сохраняем в БД
          fs.unlinkSync(file.path);
        } else {
          continue; // Пропускаем файл, если нет данных
        }
        
        // Генерируем уникальное имя файла
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = file.originalname.split('.').pop() || '';
        const basename = file.originalname.replace(/\.[^/.]+$/, '');
        const filename = `${basename}-${uniqueSuffix}.${ext}`;
        
        photoFiles.push({
          filename: filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: buffer
        });
      }
    }

    // Создание отчета (файлы сохраняются в таблицу images, ID сохраняются в photos)
    const report = await reportService.createReport(
      application_id,
      offer_id,
      user_id,
      ratingNum,
      feedback,
      photoFiles
    );
    
    const response: ReportResponse = {
      success: true,
      data: {
        report_id: report.report_id,
        application_id: report.application_id,
        offer_id: report.offer_id,
        user_id: report.user_id,
        rating: report.rating,
        feedback: report.feedback,
        photos: report.photos, // Массив ID изображений
        created_at: report.submitted_at || report.created_at
      }
    };
    
    res.status(201).json(response);
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

