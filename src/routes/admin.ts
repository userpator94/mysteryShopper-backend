import { Router } from 'express';
import {
  adminLogin,
  getAdminStatsOverview,
  getAdminApplications,
  getAdminQueues,
  getAdminUsers,
  getAdminLegalDocs,
  streamAdminLegalDoc
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

// GET /api/admin/legal/docs
router.get('/legal/docs', getAdminLegalDocs);

// GET /api/admin/legal/docs/:role
router.get('/legal/docs/:role', streamAdminLegalDoc);

export default router;
