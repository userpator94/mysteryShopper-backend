import { Router } from 'express';
import { login, signup, logout, getMe } from '../controllers/authController';
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

// GET /api/me — текущий пользователь (id, name, surname, email, phone, role, company?, description?, website?)
router.get('/me', authenticateJWT, getMe);

// POST /api/logout
router.post(
  '/logout',
  authenticateJWT,
  logout
);

export default router;

