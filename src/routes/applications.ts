import { Router } from 'express';
import { patchApplicationStatus } from '../controllers/applyController';
import { authenticateJWT, requireEmployer } from '../middleware/authMiddleware';

const router = Router();

// PATCH /api/applications/:id — смена статуса заявки (approved | rejected), только владелец оффера
router.patch('/:id', authenticateJWT, requireEmployer, patchApplicationStatus);

export default router;
