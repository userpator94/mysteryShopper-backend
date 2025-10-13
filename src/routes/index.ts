import { Router } from 'express';
import { Request, Response } from 'express';
import homepageRoutes from './homepage';
import favoritesRoutes from './favorites';

const router = Router();

// Example route
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Welcome to Mystery Shopper API',
    version: '1.0.0',
      endpoints: {
        health: '/health',
        api: '/api',
        offers: {
          list: '/api/offers',
          byId: '/api/offers/:id',
          promoOffers: '/api/promo-offers',
          banner: '/api/banner',
          authors: '/api/authors/:id',
          images: '/api/images/:id'
        },
        favorites: {
          list: '/api/favorites',
          add: '/api/favorites',
          remove: '/api/favorites/:offerId'
        }
      }
  });
});

// Example protected route
router.get('/protected', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'This is a protected route',
    timestamp: new Date().toISOString()
  });
});

// Direct routes (without homepage prefix)
router.use('/', homepageRoutes);

// Favorites routes
router.use('/favorites', favoritesRoutes);

export default router;

