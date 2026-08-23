import { Request } from 'express';

export const getClientIP = (req: Request): string => {
  return (
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

export { isValidEmailFormat as validateEmail } from './emailFormat';

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, '');
};

