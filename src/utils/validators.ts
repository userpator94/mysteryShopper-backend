import { body, ValidationChain } from 'express-validator';
import { isValidEmailFormat } from './emailFormat';

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

const emailBodyValidation: ValidationChain[] = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email обязателен')
    .custom((value) => {
      if (!isValidEmailFormat(String(value))) {
        throw new Error('Неверный формат email');
      }
      return true;
    })
];

export const loginValidation: ValidationChain[] = [
  ...emailBodyValidation,

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

  ...emailBodyValidation,

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
    .withMessage('Пароль может содержать только латинские буквы, цифры и символы !@#$%^&*()-_=+'),

  body('role')
    .optional()
    .isIn(['user', 'employer'])
    .withMessage('Роль должна быть user или employer'),

  body('company')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Название компании не более 255 символов'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Описание не более 2000 символов'),

  body('website')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('URL не более 500 символов')
];

export const changePasswordValidation: ValidationChain[] = [
  body('current_password')
    .notEmpty()
    .withMessage('Текущий пароль обязателен'),

  body('new_password')
    .notEmpty()
    .withMessage('Новый пароль обязателен')
    .isLength({ min: 6 })
    .withMessage('Пароль должен содержать минимум 6 символов')
    .matches(passwordRegex)
    .withMessage('Пароль может содержать только латинские буквы, цифры и символы !@#$%^&*()-_=+')
    .custom((value, { req }) => {
      const cur = (req.body as { current_password?: string })?.current_password;
      if (typeof cur === 'string' && value === cur) {
        throw new Error('Новый пароль должен отличаться от текущего');
      }
      return true;
    })
];

export const forgotPasswordValidation: ValidationChain[] = [...emailBodyValidation];

export const resendVerificationValidation: ValidationChain[] = [...emailBodyValidation];

export const verifyEmailValidation: ValidationChain[] = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('Токен обязателен')
    .isLength({ min: 32, max: 128 })
    .withMessage('Неверный формат токена')
];

export const resetPasswordValidation: ValidationChain[] = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('Токен обязателен')
    .isLength({ min: 32, max: 128 })
    .withMessage('Неверный формат токена'),

  body('new_password')
    .notEmpty()
    .withMessage('Новый пароль обязателен')
    .isLength({ min: 6 })
    .withMessage('Пароль должен содержать минимум 6 символов')
    .matches(passwordRegex)
    .withMessage('Пароль может содержать только латинские буквы, цифры и символы !@#$%^&*()-_=+')
];

// UUID validation regex
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const applyValidation: ValidationChain[] = [
  body('offer_id')
    .trim()
    .notEmpty()
    .withMessage('offer_id обязателен')
    .matches(uuidRegex)
    .withMessage('Неверный формат offer_id. Ожидается UUID')
];

export const reportValidation: ValidationChain[] = [
  body('application_id')
    .trim()
    .notEmpty()
    .withMessage('application_id обязателен')
    .matches(uuidRegex)
    .withMessage('Неверный формат application_id. Ожидается UUID'),
  
  body('offer_id')
    .trim()
    .notEmpty()
    .withMessage('offer_id обязателен')
    .matches(uuidRegex)
    .withMessage('Неверный формат offer_id. Ожидается UUID'),
  
  body('user_id')
    .trim()
    .notEmpty()
    .withMessage('user_id обязателен')
    .matches(uuidRegex)
    .withMessage('Неверный формат user_id. Ожидается UUID'),
  
  body('rating')
    .notEmpty()
    .withMessage('rating обязателен')
    .isInt({ min: 1, max: 5 })
    .withMessage('rating должен быть числом от 1 до 5'),
  
  body('feedback')
    .notEmpty()
    .withMessage('feedback обязателен')
    .custom((value) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('feedback должен быть объектом JSON');
      }
      return true;
    })
];

/** Реквизиты для вывода Рэшек (PUT /me/withdraw-details). */
export const withdrawDetailsValidation: ValidationChain[] = [
  body('method')
    .trim()
    .notEmpty()
    .withMessage('Способ вывода обязателен')
    .isIn(['bank_account', 'phone', 'card'])
    .withMessage('Способ вывода: bank_account, phone или card'),

  body('last_name')
    .trim()
    .notEmpty()
    .withMessage('Фамилия обязательна')
    .isLength({ min: 1, max: 100 })
    .withMessage('Фамилия: не более 100 символов')
    .matches(nameRegex)
    .withMessage('Фамилия может содержать только буквы, пробелы и дефисы'),

  body('first_name')
    .trim()
    .notEmpty()
    .withMessage('Имя обязательно')
    .isLength({ min: 1, max: 100 })
    .withMessage('Имя: не более 100 символов')
    .matches(nameRegex)
    .withMessage('Имя может содержать только буквы, пробелы и дефисы'),

  body('middle_name')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Отчество: не более 100 символов')
    .matches(nameRegex)
    .withMessage('Отчество может содержать только буквы, пробелы и дефисы'),

  body('account_number')
    .if(body('method').equals('bank_account'))
    .trim()
    .notEmpty()
    .withMessage('Номер счёта обязателен')
    .custom((value) => {
      const digits = String(value ?? '').replace(/\D/g, '');
      if (digits.length !== 20) throw new Error('Номер счёта должен содержать ровно 20 цифр');
      return true;
    }),

  body('bik')
    .if(body('method').equals('bank_account'))
    .trim()
    .notEmpty()
    .withMessage('БИК обязателен')
    .custom((value) => {
      const digits = String(value ?? '').replace(/\D/g, '');
      if (digits.length !== 9) throw new Error('БИК должен содержать ровно 9 цифр');
      return true;
    }),

  body('bank_name')
    .if(body('method').equals('phone'))
    .trim()
    .notEmpty()
    .withMessage('Укажите банк для перевода по телефону')
    .isLength({ max: 200 })
    .withMessage('Название банка: не более 200 символов'),

  body('bank_name')
    .if(body('method').equals('bank_account'))
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Название банка: не более 200 символов'),

  body('phone')
    .if(body('method').equals('phone'))
    .trim()
    .notEmpty()
    .withMessage('Номер телефона обязателен')
    .custom((value) => {
      if (!validatePhoneDigits(String(value ?? ''))) {
        throw new Error('Телефон должен быть в формате +7 (XXX) XXX-XX-XX');
      }
      return true;
    }),

  body('card_number')
    .if(body('method').equals('card'))
    .trim()
    .notEmpty()
    .withMessage('Номер карты обязателен')
    .custom((value) => {
      const digits = String(value ?? '').replace(/\D/g, '');
      if (digits.length !== 16) {
        throw new Error('Номер карты должен содержать ровно 16 цифр');
      }
      return true;
    }),
];

/** Минимальная сумма вывода Рэшек. */
export const MIN_WITHDRAW_AMOUNT = 2000;

/** Создание заявки на вывод (POST /me/withdraw-requests). */
export const withdrawRequestValidation: ValidationChain[] = [
  body('amount')
    .notEmpty()
    .withMessage('Сумма обязательна')
    .isInt({ min: MIN_WITHDRAW_AMOUNT })
    .withMessage(`Минимальная сумма вывода — ${MIN_WITHDRAW_AMOUNT} Рэшек`)
    .toInt(),
];
