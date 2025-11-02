import { Request, Response } from 'express';
import { LoginRequest, SignupRequest, LoginResponse, SignupResponse, ApiErrorResponse, AuthUser } from '../types';
import { dbService } from '../services/databaseService';
import { authService } from '../services/authService';
import { normalizePhone, formatPhone } from '../utils/validators';

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

    // Формируем объект пользователя для ответа
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name || '',
      lastname: user.surname || '',
      phone: user.phone ? formatPhone(user.phone) : ''
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
    const { name, lastname, email, phone, password }: SignupRequest = req.body;

    // Нормализуем телефон для хранения в базе
    const normalizedPhone = normalizePhone(phone);

    // Проверяем существование email
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

    // Проверяем существование телефона
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

    // Хешируем пароль
    const hashedPassword = await authService.hashPassword(password);

    // Создаем пользователя
    const newUser = await dbService.createUser({
      email,
      password: hashedPassword,
      phone: normalizedPhone,
      name: name.trim(),
      lastname: lastname.trim()
    });

    // Формируем объект пользователя для ответа (форматируем телефон)
    const authUser: AuthUser = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      lastname: newUser.lastname,
      phone: formatPhone(newUser.phone)
    };

    // Генерируем JWT токен
    const token = authService.generateToken(authUser);
    const expiresIn = authService.getTokenExpiresIn();

    // Логируем успешную регистрацию (без пароля)
    console.log(`✅ User registered: ${newUser.email} (ID: ${newUser.id})`);

    const response: SignupResponse = {
      success: true,
      data: {
        token,
        user: {
          ...authUser,
          createdAt: newUser.createdAt.toISOString()
        },
        expiresIn
      }
    };

    res.status(201).json(response);
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

