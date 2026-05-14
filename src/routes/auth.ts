import { Router } from 'express';
import { login, signup, logout, getMe, changePassword } from '../controllers/authController';
import { authenticateJWT } from '../middleware/authMiddleware';
import { loginValidation, signupValidation, changePasswordValidation } from '../utils/validators';
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

// PATCH /api/me/password — смена пароля
router.patch(
  '/me/password',
  authenticateJWT,
  changePasswordValidation,
  handleValidationErrors,
  changePassword
);

// POST /api/logout
router.post(
  '/logout',
  authenticateJWT,
  logout
);

export default router;

