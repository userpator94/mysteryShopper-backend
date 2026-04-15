import { Router } from 'express';
import { Request, Response } from 'express';
import homepageRoutes from './homepage';
import favoritesRoutes from './favorites';
import userStatisticsRoutes from './userStatistics';
import authRoutes from './auth';
import offersRoutes from './offers';
import applyRoutes from './apply';
import appliesRoutes from './applies';
import applicationsRoutes from './applications';
import reportRoutes from './report';
import rewardsRoutes from './rewards';

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
      auth: {
        login: 'POST /api/login',
        signup: 'POST /api/signup'
      },
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
      },
      userStatistics: {
        post: '/api/user/stats'
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

// Заказчик / отчёты / my-report — важно раньше homepage: там же GET /offers/:id (карточка задания).
router.use('/', offersRoutes);

// Direct routes (without homepage prefix)
router.use('/', homepageRoutes);

// Favorites routes
router.use('/favorites', favoritesRoutes);

// User Statistics routes
router.use('/user/stats', userStatisticsRoutes);

// Authentication routes
router.use('/', authRoutes);

// Apply routes
router.use('/apply', applyRoutes);

// Applies routes (GET /api/applies)
router.use('/applies', appliesRoutes);

// Applications (PATCH /api/applications/:id — для заказчика)
router.use('/applications', applicationsRoutes);

// Report routes
router.use('/report', reportRoutes);

// Rewards (executor)
router.use('/', rewardsRoutes);

export default router;

