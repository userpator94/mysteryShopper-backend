import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Вариант 1: Сохранение на диск (текущий вариант)
// Создаем папку для загрузки файлов, если её нет
const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка хранилища для multer (диск - для сохранения на диск)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

// Вариант 2: Сохранение в память (для сохранения бинарников в БД)
const memoryStorage = multer.memoryStorage();

// Фильтр для проверки типа файла (только изображения)
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Разрешены только изображения (JPEG, PNG, GIF, WebP)'));
  }
};

// Настройка multer для сохранения на диск
export const uploadPhotosDisk = multer({
  storage: diskStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB максимум на файл
    files: 10 // Максимум 10 файлов
  }
});

// Настройка multer для сохранения в память (для БД)
export const uploadPhotosMemory = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB максимум на файл
    files: 10 // Максимум 10 файлов
  }
});

// Middleware для обработки нескольких файлов с полем 'photos' (на диск)
export const uploadReportPhotos = uploadPhotosDisk.array('photos', 10);

// Middleware для обработки нескольких файлов с полем 'photos' (в память для БД)
export const uploadReportPhotosToMemory = uploadPhotosMemory.array('photos', 10);

