import { Router } from 'express';
import {
  login,
  signup,
  logout,
  getMe,
  changePassword,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword
} from '../controllers/authController';
import { authenticateJWT } from '../middleware/authMiddleware';
import { authEmailRateLimiter } from '../middleware/authEmailRateLimiter';
import {
  loginValidation,
  signupValidation,
  changePasswordValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  forgotPasswordValidation,
  resetPasswordValidation
} from '../utils/validators';
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

// POST /api/verify-email
router.post(
  '/verify-email',
  verifyEmailValidation,
  handleValidationErrors,
  verifyEmail
);

// POST /api/resend-verification
router.post(
  '/resend-verification',
  authEmailRateLimiter,
  resendVerificationValidation,
  handleValidationErrors,
  resendVerification
);

// POST /api/forgot-password
router.post(
  '/forgot-password',
  authEmailRateLimiter,
  forgotPasswordValidation,
  handleValidationErrors,
  forgotPassword
);

// POST /api/reset-password
router.post(
  '/reset-password',
  resetPasswordValidation,
  handleValidationErrors,
  resetPassword
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
