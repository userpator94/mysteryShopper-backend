import { Router } from 'express';
import { getBanner, getOffers, getOfferById, getPromoOffers, getAuthorById, getImageById } from '../controllers/homepageController';

const router = Router();

// Direct API routes (without homepage prefix)
router.get('/banner', getBanner);
router.get('/offers', getOffers);
router.get('/offers/:id', getOfferById);
router.get('/promo-offers', getPromoOffers);
router.get('/authors/:id', getAuthorById);
router.get('/images/:id', getImageById);

export default router;
