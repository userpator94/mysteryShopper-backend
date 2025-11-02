import { Router } from 'express';
import { login, signup } from '../controllers/authController';
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

export default router;

