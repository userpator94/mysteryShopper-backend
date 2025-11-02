import { body, ValidationChain } from 'express-validator';

// Email validation regex: only latin letters, numbers, and symbols ._-@
const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Password validation regex: latin letters, numbers, and symbols !@#$%^&*()-_=+
const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()\-_=+]+$/;

// Name/Lastname validation regex: latin, cyrillic letters, spaces, and hyphens
const nameRegex = /^[a-zA-Zа-яА-ЯёЁ\s-]+$/;

// Phone validation: format +7 (XXX) XXX-XX-XX
const phoneRegex = /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;

// Helper function to normalize phone number from +7 (999) 999-99-99 to 79999999999
export const normalizePhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

// Helper function to format phone number from 79999999999 to +7 (999) 999-99-99
export const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  return phone; // Return original if format is unexpected
};

// Validate phone has exactly 11 digits starting with 7
export const validatePhoneDigits = (phone: string): boolean => {
  const digits = normalizePhone(phone);
  return digits.length === 11 && digits.startsWith('7');
};

export const loginValidation: ValidationChain[] = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email обязателен')
    .matches(emailRegex)
    .withMessage('Неверный формат email')
    .custom((value) => {
      // Check for only latin letters, numbers, and allowed symbols
      const localPart = value.split('@')[0];
      if (!/^[a-zA-Z0-9._-]+$/.test(localPart)) {
        throw new Error('Email может содержать только латинские буквы, цифры и символы ._-@');
      }
      return true;
    }),

  body('password')
    .notEmpty()
    .withMessage('Пароль обязателен')
    .isLength({ min: 6 })
    .withMessage('Пароль должен содержать минимум 6 символов')
    .matches(passwordRegex)
    .withMessage('Пароль может содержать только латинские буквы, цифры и символы !@#$%^&*()-_=+')
];

export const signupValidation: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Имя обязательно')
    .matches(nameRegex)
    .withMessage('Имя может содержать только латинские и кириллические буквы, пробелы и дефисы'),

  body('lastname')
    .trim()
    .notEmpty()
    .withMessage('Фамилия обязательна')
    .matches(nameRegex)
    .withMessage('Фамилия может содержать только латинские и кириллические буквы, пробелы и дефисы'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email обязателен')
    .matches(emailRegex)
    .withMessage('Неверный формат email')
    .custom((value) => {
      const localPart = value.split('@')[0];
      if (!/^[a-zA-Z0-9._-]+$/.test(localPart)) {
        throw new Error('Email может содержать только латинские буквы, цифры и символы ._-@');
      }
      return true;
    }),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Номер телефона обязателен')
    .matches(phoneRegex)
    .withMessage('Неверный формат номера телефона. Формат: +7 (999) 999-99-99')
    .custom((value) => {
      if (!validatePhoneDigits(value)) {
        throw new Error('Номер телефона должен содержать ровно 11 цифр и начинаться с 7');
      }
      return true;
    }),

  body('password')
    .notEmpty()
    .withMessage('Пароль обязателен')
    .isLength({ min: 6 })
    .withMessage('Пароль должен содержать минимум 6 символов')
    .matches(passwordRegex)
    .withMessage('Пароль может содержать только латинские буквы, цифры и символы !@#$%^&*()-_=+')
];

