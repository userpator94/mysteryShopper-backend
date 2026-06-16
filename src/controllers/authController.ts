import { Request, Response } from 'express';
import { LoginRequest, SignupRequest, LoginResponse, SignupResponse, LogoutResponse, ApiErrorResponse, AuthUser, MeResponse } from '../types';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { dbService } from '../services/databaseService';
import { authService } from '../services/authService';
import { issueAuthToken, consumeAuthToken } from '../services/authTokenService';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService';
import { normalizePhone, formatPhone } from '../utils/validators';
import { avatarEmojiFromAvatarId } from '../utils/avatarEmoji';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginRequest = req.body;

    // Получаем пользователя по email
    const user = await dbService.getUserByEmail(email);

    if (!user) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Пользователь с таким email не найден'
        }
      };
      res.status(404).json(response);
      return;
    }

    // Проверяем активность пользователя
    if (!user.is_active) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'USER_NOT_ACTIVE',
          message: 'Пользователь неактивен'
        }
      };
      res.status(401).json(response);
      return;
    }

    // Проверяем пароль
    const isPasswordValid = await authService.comparePassword(password, user.password_hash);
    
    if (!isPasswordValid) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Неверный email или пароль'
        }
      };
      res.status(401).json(response);
      return;
    }

    // Проверяем подтверждение email
    if (!user.email_verified) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Подтвердите email. Проверьте почту или запросите письмо повторно.'
        }
      };
      res.status(403).json(response);
      return;
    }

    const role = (user.role === 'employer' ? 'employer' : 'user') as AuthUser['role'];
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name || '',
      surname: user.surname || '',
      phone: user.phone ? formatPhone(user.phone) : '',
      role,
      avatar_emoji: role === 'user' ? avatarEmojiFromAvatarId(user.avatar_id) : null
    };

    // Генерируем JWT токен
    const token = authService.generateToken(authUser);
    const expiresIn = authService.getTokenExpiresIn();

    // Логируем успешный вход (без пароля)
    console.log(`✅ User logged in: ${user.email} (ID: ${user.id})`);

    const response: LoginResponse = {
      success: true,
      data: {
        token,
        user: authUser,
        expiresIn
      }
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error in login:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' 
          ? `Внутренняя ошибка сервера: ${error?.message || 'Unknown error'}`
          : 'Внутренняя ошибка сервера'
      }
    };
    res.status(500).json(response);
  }
};

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, lastname, email, phone, password, role: reqRole, company, description, website }: SignupRequest = req.body;
    const role = reqRole === 'employer' ? 'employer' : 'user';

    if (role === 'employer' && !(company && company.trim())) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Для регистрации как заказчик необходимо указать компанию (company)'
        }
      };
      res.status(422).json(response);
      return;
    }

    const normalizedPhone = normalizePhone(phone);

    const emailExists = await dbService.isEmailExists(email);
    if (emailExists) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Пользователь с таким email уже зарегистрирован'
        }
      };
      res.status(409).json(response);
      return;
    }

    const phoneExists = await dbService.isPhoneExists(normalizedPhone);
    if (phoneExists) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'PHONE_ALREADY_EXISTS',
          message: 'Пользователь с таким номером телефона уже зарегистрирован'
        }
      };
      res.status(409).json(response);
      return;
    }

    const hashedPassword = await authService.hashPassword(password);

    const newUser = await dbService.createUser({
      email,
      password: hashedPassword,
      phone: normalizedPhone,
      name: name.trim(),
      lastname: lastname.trim(),
      role
    });

    if (role === 'employer') {
      await dbService.createEmployer({
        user_id: newUser.id,
        company: company!.trim(),
        description: description?.trim() || undefined,
        website: website?.trim() || undefined
      });
    }

    const verifyToken = await issueAuthToken(newUser.id, 'email_verification');
    try {
      await sendVerificationEmail({
        to: newUser.email,
        name: newUser.name,
        token: verifyToken
      });
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr);
    }

    console.log(`✅ User registered (pending email verify): ${newUser.email} (ID: ${newUser.id}, role: ${role})`);

    const response: SignupResponse = {
      success: true,
      data: {
        message: 'Регистрация успешна. Проверьте почту и подтвердите email.',
        email: newUser.email
      }
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error in signup:', error);
    
    // Обработка ошибок базы данных
    if (error.code === '23505') { // Unique violation
      if (error.constraint?.includes('email')) {
        const response: ApiErrorResponse = {
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Пользователь с таким email уже зарегистрирован'
          }
        };
        res.status(409).json(response);
        return;
      }
      if (error.constraint?.includes('phone')) {
        const response: ApiErrorResponse = {
          success: false,
          error: {
            code: 'PHONE_ALREADY_EXISTS',
            message: 'Пользователь с таким номером телефона уже зарегистрирован'
          }
        };
        res.status(409).json(response);
        return;
      }
    }

    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' 
          ? `Внутренняя ошибка сервера: ${error?.message || 'Unknown error'}`
          : 'Внутренняя ошибка сервера'
      }
    };
    res.status(500).json(response);
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const user = await dbService.getUserByEmail(req.userEmail!);
    if (!user || user.id !== userId) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Пользователь не найден' }
      };
      res.status(404).json(response);
      return;
    }
    const role = (user.role === 'employer' ? 'employer' : 'user') as 'user' | 'employer';
    const data: MeResponse['data'] = {
      id: user.id,
      name: user.name || '',
      surname: user.surname || '',
      email: user.email,
      phone: user.phone ? formatPhone(user.phone) : '',
      role,
      email_verified: Boolean(user.email_verified),
      avatar_emoji: role === 'user' ? avatarEmojiFromAvatarId(user.avatar_id) : null
    };
    if (role === 'employer') {
      const employer = await dbService.getEmployerByUserId(userId);
      if (employer) {
        data.company = employer.company;
        data.description = employer.description ?? undefined;
        data.website = employer.website ?? undefined;
      }
    }
    const response: MeResponse = { success: true, data };
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error in getMe:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' ? error?.message : 'Внутренняя ошибка сервера'
      }
    };
    res.status(500).json(response);
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const userEmail = req.userEmail;

    // Логируем выход пользователя
    console.log(`🚪 User logged out: ${userEmail || 'unknown'} (ID: ${userId})`);

    const response: LogoutResponse = {
      success: true,
      data: {
        message: 'Выход выполнен успешно'
      }
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error in logout:', error);
    
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' 
          ? `Внутренняя ошибка сервера: ${error?.message || 'Unknown error'}`
          : 'Внутренняя ошибка сервера'
      }
    };
    res.status(500).json(response);
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { current_password, new_password } = req.body as {
      current_password?: string;
      new_password?: string;
    };

    const user = await dbService.getUserByEmail(req.userEmail!);
    if (!user || user.id !== userId) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Пользователь не найден' }
      };
      res.status(404).json(response);
      return;
    }

    const isCurrentValid = await authService.comparePassword(String(current_password || ''), user.password_hash);
    if (!isCurrentValid) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Неверный текущий пароль' }
      };
      res.status(401).json(response);
      return;
    }

    const hashed = await authService.hashPassword(String(new_password || ''));
    const updated = await dbService.updateUserPasswordHash(userId, hashed);
    if (!updated) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Пользователь не найден' }
      };
      res.status(404).json(response);
      return;
    }

    res.status(200).json({
      success: true,
      data: { message: 'Пароль успешно обновлён' }
    });
  } catch (error: any) {
    console.error('Error in changePassword:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message:
          process.env.NODE_ENV === 'development'
            ? `Внутренняя ошибка сервера: ${error?.message || 'Unknown error'}`
            : 'Внутренняя ошибка сервера'
      }
    };
    res.status(500).json(response);
  }
};

const GENERIC_EMAIL_SENT_MESSAGE =
  'Если аккаунт с таким email существует, мы отправили письмо с инструкциями.';

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body as { token?: string };
    const consumed = await consumeAuthToken(String(token || ''), 'email_verification');
    if (!consumed) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_OR_EXPIRED_TOKEN',
          message: 'Ссылка недействительна или истекла. Запросите новое письмо.'
        }
      };
      res.status(400).json(response);
      return;
    }

    await dbService.setEmailVerified(consumed.userId, true);

    res.status(200).json({
      success: true,
      data: { message: 'Email успешно подтверждён. Теперь вы можете войти.' }
    });
  } catch (error: any) {
    console.error('Error in verifyEmail:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development'
          ? `Внутренняя ошибка сервера: ${error?.message || 'Unknown error'}`
          : 'Внутренняя ошибка сервера'
      }
    };
    res.status(500).json(response);
  }
};

export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };
    const user = await dbService.getUserByEmail(String(email || '').trim());

    if (user && user.is_active && !user.email_verified) {
      const token = await issueAuthToken(user.id, 'email_verification');
      try {
        await sendVerificationEmail({
          to: user.email,
          name: user.name || '',
          token
        });
      } catch (emailErr) {
        console.error('Failed to resend verification email:', emailErr);
      }
    }

    res.status(200).json({
      success: true,
      data: { message: GENERIC_EMAIL_SENT_MESSAGE }
    });
  } catch (error: any) {
    console.error('Error in resendVerification:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development'
          ? `Внутренняя ошибка сервера: ${error?.message || 'Unknown error'}`
          : 'Внутренняя ошибка сервера'
      }
    };
    res.status(500).json(response);
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };
    const user = await dbService.getUserByEmail(String(email || '').trim());

    if (user && user.is_active) {
      const token = await issueAuthToken(user.id, 'password_reset');
      try {
        await sendPasswordResetEmail({
          to: user.email,
          name: user.name || '',
          token
        });
      } catch (emailErr) {
        console.error('Failed to send password reset email:', emailErr);
      }
    }

    res.status(200).json({
      success: true,
      data: { message: GENERIC_EMAIL_SENT_MESSAGE }
    });
  } catch (error: any) {
    console.error('Error in forgotPassword:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development'
          ? `Внутренняя ошибка сервера: ${error?.message || 'Unknown error'}`
          : 'Внутренняя ошибка сервера'
      }
    };
    res.status(500).json(response);
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, new_password } = req.body as { token?: string; new_password?: string };
    const consumed = await consumeAuthToken(String(token || ''), 'password_reset');
    if (!consumed) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_OR_EXPIRED_TOKEN',
          message: 'Ссылка недействительна или истекла. Запросите сброс пароля снова.'
        }
      };
      res.status(400).json(response);
      return;
    }

    const hashed = await authService.hashPassword(String(new_password || ''));
    const updated = await dbService.updateUserPasswordHash(consumed.userId, hashed);
    if (!updated) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Пользователь не найден' }
      };
      res.status(404).json(response);
      return;
    }

    res.status(200).json({
      success: true,
      data: { message: 'Пароль успешно изменён. Теперь вы можете войти.' }
    });
  } catch (error: any) {
    console.error('Error in resetPassword:', error);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development'
          ? `Внутренняя ошибка сервера: ${error?.message || 'Unknown error'}`
          : 'Внутренняя ошибка сервера'
      }
    };
    res.status(500).json(response);
  }
};
