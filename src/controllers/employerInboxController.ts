import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { ApiErrorResponse } from '../types';
import { dbService } from '../services/databaseService';
import { withReportApiFields } from '../utils/reportStatus';

export const getEmployerPendingApplications = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const employerId = req.employerId!;
    const rows = await dbService.getEmployerPendingApplications(employerId);
    res.status(200).json({ success: true, data: rows });
  } catch (error: unknown) {
    console.error('getEmployerPendingApplications:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при загрузке заявок' }
    };
    res.status(500).json(response);
  }
};

export const getEmployerInboxCounts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const employerId = req.employerId!;
    const counts = await dbService.getEmployerInboxCounts(employerId);
    res.status(200).json({ success: true, data: counts });
  } catch (error: unknown) {
    console.error('getEmployerInboxCounts:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при загрузке счётчиков' }
    };
    res.status(500).json(response);
  }
};

export const getEmployerPendingReports = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const employerId = req.employerId!;
    const rows = await dbService.getEmployerPendingReports(employerId);
    res.status(200).json({
      success: true,
      data: rows.map((r) => withReportApiFields(r as Record<string, unknown>))
    });
  } catch (error: unknown) {
    console.error('getEmployerPendingReports:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при загрузке отчётов' }
    };
    res.status(500).json(response);
  }
};
