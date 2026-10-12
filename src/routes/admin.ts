import { Router } from 'express';
import {
  adminLogin,
  getAdminStatsOverview,
  getAdminApplications,
  getAdminQueues,
  getAdminUsers
} from '../controllers/adminController';
import { authenticateJWT, requireAdmin } from '../middleware/authMiddleware';
import { adminLoginRateLimiter } from '../middleware/adminLoginRateLimiter';
import { adminLoginValidation } from '../utils/validators';
import { handleValidationErrors } from '../middleware/validationHandler';

const router = Router();

// POST /api/admin/login
router.post(
  '/login',
  adminLoginRateLimiter,
  adminLoginValidation,
  handleValidationErrors,
  adminLogin
);

router.use(authenticateJWT, requireAdmin);

// GET /api/admin/stats/overview
router.get('/stats/overview', getAdminStatsOverview);

// GET /api/admin/applications
router.get('/applications', getAdminApplications);

// GET /api/admin/queues
router.get('/queues', getAdminQueues);

// GET /api/admin/users
router.get('/users', getAdminUsers);

export default router;
