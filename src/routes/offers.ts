import { Router } from 'express';
import { createOffer, getMyOffers, updateOffer, deleteOffer } from '../controllers/offersController';
import { getOfferApplications } from '../controllers/applyController';
import { getOfferReports, getOfferReportById } from '../controllers/employerReportsController';
import { authenticateJWT, requireEmployer } from '../middleware/authMiddleware';

const router = Router();

// GET /api/my/offers — только employer (должен быть выше /offers/:id, чтобы "my" не попал в :id)
router.get('/my/offers', authenticateJWT, requireEmployer, getMyOffers);

// Отчёты по офферу (заказчик) — до маршрутов с одним сегментом :id
router.get(
  '/offers/:offerId/reports/:reportId',
  authenticateJWT,
  requireEmployer,
  getOfferReportById
);
router.get('/offers/:offerId/reports', authenticateJWT, requireEmployer, getOfferReports);

// GET /api/offers/:id/applications — список заявок по офферу (только владелец)
router.get('/offers/:id/applications', authenticateJWT, requireEmployer, getOfferApplications);

// POST /api/offers — только employer
router.post('/offers', authenticateJWT, requireEmployer, createOffer);

// PATCH /api/offers/:id — только владелец (employer)
router.patch('/offers/:id', authenticateJWT, requireEmployer, updateOffer);

// DELETE /api/offers/:id — только владелец
router.delete('/offers/:id', authenticateJWT, requireEmployer, deleteOffer);

export default router;
