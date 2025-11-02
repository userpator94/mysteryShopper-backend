import { Router } from 'express';
import { login, signup, logout } from '../controllers/authController';
import { authenticateJWT } from '../middleware/authMiddleware';
import { loginValidation, signupValidation } from '../utils/validators';
import { handleValidationErrors } from '../middleware/validationHandler';

const router = Router();

// POST /api/login
router.post(
  '/login',
  loginValidation,
  handleValidationErrors,
  login
);

// POST /api/signup
router.post(
  '/signup',
  signupValidation,
  handleValidationErrors,
  signup
);

// POST /api/logout
router.post(
  '/logout',
  authenticateJWT,
  logout
);

export default router;

