import { Request, Response } from 'express';
import { LoginRequest, LoginResponse, AuthUser, ApiErrorResponse } from '../types';
import { dbService } from '../services/databaseService';
import { authService } from '../services/authService';
import { adminService } from '../services/adminService';
import { formatPhone } from '../utils/validators';
import { normalizeAuthRole } from '../utils/authRole';
import { config } from '../config';

const INVALID_CREDENTIALS_MSG = 'Неверный логин или пароль';

/**
 * POST /api/admin/login — вход только для role=admin.
 * Нейтральные ошибки, без утечки существования email.
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginRequest = req.body;

    const user = await dbService.getUserByEmail(email);

    if (!user || !user.is_active) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: INVALID_CREDENTIALS_MSG
        }
      };
      res.status(401).json(response);
      return;
    }

    const isPasswordValid = await authService.comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: INVALID_CREDENTIALS_MSG
        }
      };
      res.status(401).json(response);
      return;
    }

    if (user.role !== 'admin') {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Доступ запрещён'
        }
      };
      res.status(403).json(response);
      return;
    }

    if (config.email.requireVerification && !user.email_verified) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Подтвердите email перед входом'
        }
      };
      res.status(403).json(response);
      return;
    }

    const role = normalizeAuthRole(user.role);
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name || '',
      surname: user.surname || '',
      phone: user.phone ? formatPhone(user.phone) : '',
      role,
      avatar_emoji: null
    };

    const token = authService.generateToken(
      authUser,
      typeof user.token_version === 'number' ? user.token_version : 0
    );
    const expiresIn = authService.getTokenExpiresIn();

    console.log(`✅ Admin logged in: ${user.email} (ID: ${user.id})`);

    const response: LoginResponse = {
      success: true,
      data: {
        token,
        user: authUser,
        expiresIn
      }
    };
    res.status(200).json(response);
  } catch (error: unknown) {
    console.error('Error in adminLogin:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Внутренняя ошибка сервера'
      }
    };
    res.status(500).json(response);
  }
};

export const getAdminStatsOverview = async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await adminService.getOverviewStats();
    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    console.error('Error in getAdminStatsOverview:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при загрузке статистики' }
    };
    res.status(500).json(response);
  }
};

export const getAdminApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = typeof req.query.status === 'string' && req.query.status.trim()
      ? req.query.status.trim()
      : undefined;
    const limitRaw = parseInt(String(req.query.limit ?? '50'), 10);
    const offsetRaw = parseInt(String(req.query.offset ?? '0'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const { rows, total } = await adminService.listApplications({ status, limit, offset });
    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error: unknown) {
    console.error('Error in getAdminApplications:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при загрузке заявок' }
    };
    res.status(500).json(response);
  }
};

export const getAdminQueues = async (req: Request, res: Response): Promise<void> => {
  try {
    const limitRaw = parseInt(String(req.query.limit ?? '50'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
    const data = await adminService.getQueues(limit);
    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    console.error('Error in getAdminQueues:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при загрузке очередей' }
    };
    res.status(500).json(response);
  }
};

export const getAdminUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const role = typeof req.query.role === 'string' && req.query.role.trim()
      ? req.query.role.trim()
      : undefined;
    const q = typeof req.query.q === 'string' && req.query.q.trim()
      ? req.query.q.trim()
      : undefined;
    const limitRaw = parseInt(String(req.query.limit ?? '50'), 10);
    const offsetRaw = parseInt(String(req.query.offset ?? '0'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const { rows, total } = await adminService.listUsers({ role, q, limit, offset });
    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error: unknown) {
    console.error('Error in getAdminUsers:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Ошибка при загрузке пользователей' }
    };
    res.status(500).json(response);
  }
};
