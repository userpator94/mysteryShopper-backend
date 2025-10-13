import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse } from '../types';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const validateUserId = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.get('X-User-Id');
  
  if (!userId) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'X-User-Id header is required'
      }
    };
    res.status(400).json(response);
    return;
  }
  
  req.userId = userId;
  next();
};
