import { Request, Response, NextFunction } from 'express';
import { Readable } from 'stream';
import busboy from 'busboy';
import { AppError } from './errorHandler';
import { ensureMultipartContentType } from '../utils/reportMultipartHelpers';

const appendField = require('append-field') as (store: Record<string, unknown>, key: string, value: string) => void;

const MAX_BODY = 15 * 1024 * 1024;
const MAX_FILE = 10 * 1024 * 1024;
const MAX_FILES = 10;

const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

function readRequestBuffer(req: Request, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let len = 0;
    req.on('data', (chunk: Buffer) => {
      len += chunk.length;
      if (len > limit) {
        req.resume();
        const err: AppError = new Error(
          'Общий размер вложений превышает 15 МБ. Уменьшите размер или количество фото.'
        );
        err.statusCode = 413;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Полный разбор multipart без multer: тот же busboy, но без проверки `req.is('multipart')`,
 * которая на части прокси/клиентов даёт пустой req.body.
 */
export function parseReportMultipart(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const buf = await readRequestBuffer(req, MAX_BODY);

      if (buf.length === 0) {
        req.body = Object.create(null);
        req.files = [];
        next();
        return;
      }

      ensureMultipartContentType(req, buf);

      const bb = busboy({
        headers: req.headers,
        limits: {
          fileSize: MAX_FILE,
          files: MAX_FILES,
          fieldSize: 2 * 1024 * 1024,
          parts: 100
        }
      });

      req.body = Object.create(null);
      const files: Express.UploadedFile[] = [];
      let pendingFileWrites = 0;
      let busboyClosed = false;
      let finished = false;

      const done = (err?: Error): void => {
        if (finished) return;
        finished = true;
        if (err) {
          next(err);
          return;
        }
        req.files = files;
        next();
      };

      const tryDone = (): void => {
        if (finished) return;
        if (busboyClosed && pendingFileWrites === 0) {
          done();
        }
      };

      bb.on('field', (name: string, value: string) => {
        appendField(req.body as Record<string, unknown>, name, value);
      });

      bb.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: { filename?: string; encoding: string; mimeType?: string }) => {
        if (finished) {
          file.resume();
          return;
        }
        if (fieldname !== 'photos' || !info.filename) {
          file.resume();
          return;
        }
        const mime = info.mimeType || 'application/octet-stream';
        if (!ALLOWED_MIMES.includes(mime)) {
          file.resume();
          bb.destroy();
          done(new Error('Разрешены только изображения (JPEG, PNG, GIF, WebP)'));
          return;
        }
        pendingFileWrites++;
        const chunks: Buffer[] = [];
        file.on('data', (c: Buffer) => chunks.push(c));
        file.on('limit', () => {
          /* лимит busboy */
        });
        file.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            const originalname = info.filename || 'photo';
            files.push({
              fieldname,
              originalname,
              encoding: info.encoding,
              mimetype: mime,
              size: buffer.length,
              buffer
            });
          } finally {
            pendingFileWrites--;
            tryDone();
          }
        });
        file.on('error', (err: Error) => done(err));
      });

      bb.on('error', (err: Error) => done(err));
      bb.on('close', () => {
        if (finished) return;
        busboyClosed = true;
        tryDone();
      });

      Readable.from(buf).pipe(bb);
    } catch (err) {
      next(err as Error);
    }
  })();
}
