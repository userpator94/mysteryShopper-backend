import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiErrorResponse } from '../types';
import { dbService } from '../services/databaseService';
import { buildOfferReportPdfBuffer } from '../services/reportPdfService';
import { withReportApiFields } from '../utils/reportStatus';

export const getOfferReports = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const employerId = req.employerId!;
    const { offerId } = req.params;
    const sortRaw = String(req.query.sortBy || 'submitted_at');
    const sortBy = sortRaw === 'task_completed_at' ? 'task_completed_at' : 'submitted_at';

    const owned = await dbService.isOfferOwnedByEmployer(offerId, employerId);
    if (!owned) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Нет доступа к этой задаче' }
      };
      res.status(403).json(response);
      return;
    }

    const rows = await dbService.getEmployerOfferReports(employerId, offerId, sortBy);
    res.status(200).json({ success: true, data: rows.map((r) => withReportApiFields(r as Record<string, unknown>)) });
  } catch (error: any) {
    console.error('getOfferReports:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при загрузке отчётов' }
    };
    res.status(500).json(response);
  }
};

export const getOfferReportById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const employerId = req.employerId!;
    const { offerId, reportId } = req.params;

    const row = await dbService.getEmployerOfferReportById(employerId, offerId, reportId);
    if (!row) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Отчёт не найден' }
      };
      res.status(404).json(response);
      return;
    }

    res.status(200).json({ success: true, data: withReportApiFields(row as Record<string, unknown>) });
  } catch (error: any) {
    console.error('getOfferReportById:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при загрузке отчёта' }
    };
    res.status(500).json(response);
  }
};

export const downloadOfferReportPdf = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const employerId = req.employerId!;
    const { offerId, reportId } = req.params;

    const row = await dbService.getEmployerOfferReportById(employerId, offerId, reportId);
    if (!row) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Отчёт не найден' }
      };
      res.status(404).json(response);
      return;
    }

    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    const host = req.get('host') || 'localhost';
    const baseUrl = `${proto}://${host}`;

    const pdf = await buildOfferReportPdfBuffer(row, baseUrl);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.pdf"`);
    res.status(200).send(pdf);
  } catch (error: any) {
    console.error('downloadOfferReportPdf:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка генерации PDF' }
    };
    res.status(500).json(response);
  }
};
