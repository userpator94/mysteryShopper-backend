import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthUser } from '../types';

export class AuthService {
  // Хеширование пароля
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  // Сравнение пароля с хешем
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Генерация JWT токена (в payload: user_id, email, role для проверки прав)
  generateToken(user: AuthUser): string {
    const payload = {
      user_id: user.id,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    } as jwt.SignOptions);
  }

  // Получение времени жизни токена в секундах
  getTokenExpiresIn(): number {
    // Парсим expiresIn (например, "24h" или "3600")
    const expiresIn = config.jwt.expiresIn;
    
    if (typeof expiresIn === 'number') {
      return expiresIn;
    }

    // Если строка с единицами измерения
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      
      switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 3600; // По умолчанию 1 час
      }
    }

    // Если просто число как строка
    const numericValue = parseInt(expiresIn, 10);
    if (!isNaN(numericValue)) {
      return numericValue;
    }

    return 3600; // По умолчанию 1 час
  }

  // Верификация токена
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error: any) {
      // Более информативные ошибки
      if (error.name === 'TokenExpiredError') {
        throw new Error('jwt expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not active');
      }
      throw new Error('Invalid token');
    }
  }
}

export const authService = new AuthService();

