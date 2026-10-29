import { Request, Response } from 'express';
import { LoginRequest, SignupRequest, LoginResponse, SignupResponse, LogoutResponse, ApiErrorResponse, AuthUser, MeResponse } from '../types';
import { AuthenticatedRequest } from '../middleware/userIdValidator';
import { dbService } from '../services/databaseService';
import { authService } from '../services/authService';
import { issueAuthToken, consumeAuthToken } from '../services/authTokenService';
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail, queueEmail } from '../services/emailService';
import { normalizePhone, formatPhone } from '../utils/validators';
import { avatarEmojiFromAvatarId } from '../utils/avatarEmoji';
import { normalizeAuthRole } from '../utils/authRole';
import { config } from '../config';
import { assertCurrentOfferVersion, getLegalOfferVersion } from '../services/legalOffersService';
import { BACKEND_VERSION } from '../config/appVersion';
import { getRequestLogger, maskEmail } from '../utils/logger';

export const login = async (req: Request, res: Response): Promise<void> => {
  const log = getRequestLogger(req);
  const startedAt = Date.now();

  try {
    const { email, password }: LoginRequest = req.body;
    const maskedEmail = maskEmail(email);

    // Получаем пользователя по email
    const dbStartedAt = Date.now();
    const user = await dbService.getUserByEmail(email);
    const dbMs = Date.now() - dbStartedAt;

    // Единый ответ — без enumeration (нет пользователя / неактивен / неверный пароль)
    const invalidCredentials = (): void => {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Неверный email или пароль'
        }
      };
      res.status(401).json(response);
    };

    if (!user || !user.is_active) {
      log.warn({
        event: 'auth.login',
        outcome: user ? 'inactive' : 'user_not_found',
        email: maskedEmail,
        dbMs
      }, 'Login rejected');
      invalidCredentials();
      return;
    }

    // Проверяем пароль
    const passwordStartedAt = Date.now();
    const isPasswordValid = await authService.comparePassword(password, user.password_hash);
    const passwordMs = Date.now() - passwordStartedAt;

    if (!isPasswordValid) {
      log.warn({
        event: 'auth.login',
        outcome: 'bad_password',
        email: maskedEmail,
        userId: user.id,
        dbMs,
        passwordMs
      }, 'Login rejected');
      invalidCredentials();
      return;
    }

    // Проверяем подтверждение email (можно временно отключить через REQUIRE_EMAIL_VERIFICATION=false)
    if (config.email.requireVerification && !user.email_verified) {
      log.warn({
        event: 'auth.login',
        outcome: 'email_not_verified',
        email: maskedEmail,
        userId: user.id,
        dbMs,
        passwordMs
      }, 'Login rejected');
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message:
            'Подтвердите email. Проверьте почту, включая папку «Спам». Письмо может прийти с задержкой в несколько минут — если его нет, запросите повторно.'
        }
      };
      res.status(403).json(response);
      return;
    }

    const role = normalizeAuthRole(user.role);
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name || '',
      surname: user.surname || '',
      phone: user.phone ? formatPhone(user.phone) : '',
      role,
      avatar_emoji: role === 'user' ? avatarEmojiFromAvatarId(user.avatar_id) : null
    };

    // Генерируем JWT токен (tv = token_version для revocation)
    const token = authService.generateToken(
      authUser,
      typeof user.token_version === 'number' ? user.token_version : 0
    );
    const expiresIn = authService.getTokenExpiresIn();

    // Логируем успешный вход (без пароля)
    log.info({
      event: 'auth.login',
      outcome: 'success',
      email: maskedEmail,
      userId: user.id,
      role,
      dbMs,
      passwordMs,
      totalMs: Date.now() - startedAt
    }, 'User logged in');

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
    log.error({
      event: 'auth.login',
      outcome: 'error',
      email: maskEmail(req.body?.email),
      totalMs: Date.now() - startedAt,
      err: error
    }, 'Error in login');
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
    const {
      name,
      lastname,
      email,
      phone,
      password,
      role: reqRole,
      company,
      description,
      website,
      accept_offer,
      offer_version
    }: SignupRequest = req.body;
    const role = reqRole === 'employer' ? 'employer' : 'user';

    const acceptOk = accept_offer === true || (accept_offer as unknown) === 'true';
    if (!acceptOk) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Необходимо принять оферту'
        }
      };
      res.status(422).json(response);
      return;
    }

    if (!assertCurrentOfferVersion(offer_version)) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Неверная версия оферты. Актуальная версия: ${getLegalOfferVersion()}`
        }
      };
      res.status(422).json(response);
      return;
    }

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
      role,
      offer_accepted_at: new Date(),
      offer_version: String(offer_version).trim()
    });

    if (role === 'employer') {
      await dbService.createEmployer({
        user_id: newUser.id,
        company: company!.trim(),
        description: description?.trim() || undefined,
        website: website?.trim() || undefined
      });
    }

    if (!config.email.requireVerification) {
      await dbService.setEmailVerified(newUser.id, true);
    } else {
      const verifyToken = await issueAuthToken(newUser.id, 'email_verification');
      queueEmail('verification email', () =>
        sendVerificationEmail({
          to: newUser.email,
          name: newUser.name,
          token: verifyToken
        })
      );
    }

    const signupMessage = config.email.requireVerification
      ? 'Регистрация успешна. Проверьте почту и подтвердите email.'
      : 'Регистрация успешна.';
    console.log(
      config.email.requireVerification
        ? `✅ User registered (pending email verify): ${newUser.email} (ID: ${newUser.id}, role: ${role})`
        : `✅ User registered (email verification disabled): ${newUser.email} (ID: ${newUser.id}, role: ${role})`
    );

    const response: SignupResponse = {
      success: true,
      data: {
        message: signupMessage,
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
    const role = normalizeAuthRole(user.role);
    const data: MeResponse['data'] = {
      id: user.id,
      name: user.name || '',
      surname: user.surname || '',
      email: user.email,
      phone: user.phone ? formatPhone(user.phone) : '',
      role,
      email_verified: Boolean(user.email_verified),
      avatar_emoji: role === 'user' ? avatarEmojiFromAvatarId(user.avatar_id) : null,
      version: BACKEND_VERSION
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

    await dbService.bumpUserTokenVersion(userId);

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

    await dbService.bumpUserTokenVersion(userId);

    queueEmail('password-changed email', () =>
      sendPasswordChangedEmail({
        to: user.email,
        name: user.name || ''
      })
    );

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
      queueEmail('resend verification email', () =>
        sendVerificationEmail({
          to: user.email,
          name: user.name || '',
          token
        })
      );
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
      queueEmail('password reset email', () =>
        sendPasswordResetEmail({
          to: user.email,
          name: user.name || '',
          token
        })
      );
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

    await dbService.bumpUserTokenVersion(consumed.userId);

    const account = await dbService.getUserEmailNameById(consumed.userId);
    if (account?.email) {
      queueEmail('password-changed email', () =>
        sendPasswordChangedEmail({
          to: account.email,
          name: account.name || ''
        })
      );
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
