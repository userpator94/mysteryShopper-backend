import { Router } from 'express';
import { getLegalOffers, streamLegalOffer } from '../controllers/legalOffersController';

const router = Router();

// GET /api/legal/offers
router.get('/offers', getLegalOffers);

// GET /api/legal/offers/:role
router.get('/offers/:role', streamLegalOffer);

export default router;
