import fs from 'fs';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../types';
import {
  getLegalOfferContentDisposition,
  isLegalOfferRole,
  listLegalOffersPublic,
  resolveLegalOfferPath
} from '../services/legalOffersService';

/** GET /api/legal/offers — публичные ссылки на оферты */
export const getLegalOffers = async (_req: Request, res: Response): Promise<void> => {
  const data = listLegalOffersPublic();
  res.status(200).json({ success: true, data });
};

/** GET /api/legal/offers/:role — stream PDF (role = user | employer) */
export const streamLegalOffer = async (req: Request, res: Response): Promise<void> => {
  const roleParam = String(req.params.role || '');
  if (!isLegalOfferRole(roleParam)) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Роль оферты должна быть user или employer'
      }
    };
    res.status(422).json(response);
    return;
  }

  let filePath: string;
  try {
    filePath = resolveLegalOfferPath(roleParam);
  } catch {
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Оферта не найдена' }
    };
    res.status(404).json(response);
    return;
  }

  if (!fs.existsSync(filePath)) {
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Файл оферты не найден на сервере' }
    };
    res.status(404).json(response);
    return;
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', getLegalOfferContentDisposition(roleParam));
  res.setHeader('Cache-Control', 'public, max-age=300');
  fs.createReadStream(filePath).pipe(res);
};
