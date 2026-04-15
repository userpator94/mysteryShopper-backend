import { Router } from 'express';
import { authenticateJWT } from '../middleware/authMiddleware';
import { rewardsService } from '../services/rewardsService';
import { dbService } from '../services/databaseService';
import type { ApiErrorResponse } from '../types';

const router = Router();

router.use(authenticateJWT);

// GET /api/me/rewards/summary
router.get('/me/rewards/summary', async (req: any, res) => {
  try {
    const userId = req.userId as string;
    const user = await dbService.getUserById(userId);
    if (!user || user.role !== 'user') {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Доступ разрешён только исполнителям' }
      };
      res.status(403).json(response);
      return;
    }
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
    const user = await dbService.getUserById(userId);
    if (!user || user.role !== 'user') {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Доступ разрешён только исполнителям' }
      };
      res.status(403).json(response);
      return;
    }
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

export default router;

