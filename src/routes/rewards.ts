import { Router } from 'express';
import { authenticateJWT } from '../middleware/authMiddleware';
import { handleValidationErrors } from '../middleware/validationHandler';
import { rewardsService } from '../services/rewardsService';
import { withdrawDetailsService } from '../services/withdrawDetailsService';
import { withdrawRequestsService } from '../services/withdrawRequestsService';
import { dbService } from '../services/databaseService';
import { withdrawDetailsValidation, withdrawRequestValidation } from '../utils/validators';
import type { ApiErrorResponse } from '../types';

const router = Router();

// Только пути rewards/withdraw — нельзя вешать authenticateJWT на весь router,
// иначе при mount на `/` перехватываются все последующие маршруты (в т.ч. /admin/login).
router.use('/me/rewards', authenticateJWT);
router.use('/me/withdraw-details', authenticateJWT);
router.use('/me/withdraw-requests', authenticateJWT);

async function requireExecutor(
  userId: string,
  res: { status: (code: number) => { json: (body: unknown) => void } }
): Promise<boolean> {
  const user = await dbService.getUserById(userId);
  if (!user || user.role !== 'user') {
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Доступ разрешён только исполнителям' }
    };
    res.status(403).json(response);
    return false;
  }
  return true;
}

// GET /api/me/rewards/summary
router.get('/me/rewards/summary', async (req: any, res) => {
  try {
    const userId = req.userId as string;
    if (!(await requireExecutor(userId, res))) return;
    const data = await rewardsService.getUserRewardsSummary(userId);
    res.json({ success: true, data });
  } catch (e: any) {
    console.error('Rewards summary error:', e);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Не удалось получить статистику вознаграждений' }
    };
    res.status(500).json(response);
  }
});

// GET /api/me/rewards?limit=20&offset=0
router.get('/me/rewards', async (req: any, res) => {
  try {
    const userId = req.userId as string;
    if (!(await requireExecutor(userId, res))) return;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
    const { total, rows } = await rewardsService.listUserRewards({ userId, limit, offset });
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (e: any) {
    console.error('Rewards list error:', e);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Не удалось получить историю вознаграждений' }
    };
    res.status(500).json(response);
  }
});

// GET /api/me/withdraw-details — сохранённые реквизиты (или null) + defaults ФИО из профиля
router.get('/me/withdraw-details', async (req: any, res) => {
  try {
    const userId = req.userId as string;
    if (!(await requireExecutor(userId, res))) return;
    const [data, defaults] = await Promise.all([
      withdrawDetailsService.getByUserId(userId),
      withdrawDetailsService.getDefaultsFromUser(userId),
    ]);
    res.json({ success: true, data, defaults });
  } catch (e: any) {
    console.error('Withdraw details get error:', e);
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Не удалось получить реквизиты для вывода' }
    };
    res.status(500).json(response);
  }
});

// PUT /api/me/withdraw-details — создать или обновить реквизиты счёта
router.put(
  '/me/withdraw-details',
  withdrawDetailsValidation,
  handleValidationErrors,
  async (req: any, res: any) => {
    try {
      const userId = req.userId as string;
      if (!(await requireExecutor(userId, res))) return;
      const data = await withdrawDetailsService.upsert(userId, {
        method: req.body.method,
        last_name: String(req.body.last_name ?? ''),
        first_name: String(req.body.first_name ?? ''),
        middle_name: req.body.middle_name ?? null,
        account_number: req.body.account_number ?? null,
        bik: req.body.bik ?? null,
        bank_name: req.body.bank_name ?? null,
        phone: req.body.phone ?? null,
        card_number: req.body.card_number ?? null,
      });
      res.json({ success: true, data });
    } catch (e: any) {
      console.error('Withdraw details put error:', e);
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Не удалось сохранить реквизиты для вывода' }
      };
      res.status(500).json(response);
    }
  }
);

// POST /api/me/withdraw-requests — заявка на вывод
router.post(
  '/me/withdraw-requests',
  withdrawRequestValidation,
  handleValidationErrors,
  async (req: any, res: any) => {
    try {
      const userId = req.userId as string;
      if (!(await requireExecutor(userId, res))) return;

      const details = await withdrawDetailsService.getByUserId(userId);
      if (!details) {
        const response: ApiErrorResponse = {
          success: false,
          error: {
            code: 'WITHDRAW_DETAILS_REQUIRED',
            message: 'Сначала сохраните реквизиты для вывода',
          },
        };
        res.status(400).json(response);
        return;
      }

      const summary = await rewardsService.getUserRewardsSummary(userId);
      const data = await withdrawRequestsService.createFromDetails({
        userId,
        amount: Number(req.body.amount),
        details,
        availableBalance: summary.balance,
      });
      res.status(201).json({ success: true, data });
    } catch (e: any) {
      console.error('Withdraw request create error:', e);
      if (e?.code === 'INSUFFICIENT_BALANCE' || e?.code === 'VALIDATION_ERROR') {
        const response: ApiErrorResponse = {
          success: false,
          error: { code: e.code, message: e.message || 'Некорректная сумма вывода' },
        };
        res.status(400).json(response);
        return;
      }
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Не удалось создать заявку на вывод' },
      };
      res.status(500).json(response);
    }
  }
);

export default router;

