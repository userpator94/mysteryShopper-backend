import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ApiErrorResponse } from '../types';

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error: any) => ({
      field: error.path || error.param,
      message: error.msg
    }));

    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: errorMessages.length === 1 
          ? errorMessages[0].message 
          : 'Ошибка валидации данных',
        ...(errorMessages.length === 1 && { field: errorMessages[0].field }),
        ...(errorMessages.length > 1 && { errors: errorMessages })
      }
    };

    res.status(400).json(response);
    return;
  }

  next();
};

