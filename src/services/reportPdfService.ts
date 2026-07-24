import path from 'path';
import { createRequire } from 'module';
import { dbService } from './databaseService';

/** Абсолютные пути к файлам pdfmake — надёжнее, чем `require('pdfmake/js/Printer')` при деплое без полного дерева node_modules. */
const requirePdf = createRequire(__dirname);
const pdfmakeRoot = path.dirname(requirePdf.resolve('pdfmake/package.json'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PdfPrinter = requirePdf(path.join(pdfmakeRoot, 'js', 'Printer.js')).default as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const URLResolver = requirePdf(path.join(pdfmakeRoot, 'js', 'URLResolver.js')).default as any;

const vfsFontsRaw = requirePdf(path.join(pdfmakeRoot, 'build', 'vfs_fonts.js')) as Record<string, string>;

/** pdfmake ожидает virtualfs с existsSync/readFileSync; сырой объект из vfs_fonts этим не обладает. */
function createVfsAdapter(): {
  existsSync: (name: string) => boolean;
  readFileSync: (name: string, options?: BufferEncoding | { encoding?: BufferEncoding }) => Buffer | string;
  writeFileSync: (name: string, content: string | Buffer) => void;
  } {
  const storage: Record<string, string> = { ...vfsFontsRaw };
  return {
    existsSync(name: string) {
      const k = String(name).replace(/^\//, '');
      return Object.prototype.hasOwnProperty.call(storage, k);
    },
    readFileSync(name: string, options?: BufferEncoding | { encoding?: BufferEncoding }) {
      const k = String(name).replace(/^\//, '');
      const b64 = storage[k];
      if (b64 === undefined) {
        throw new Error(`File '${k}' not found in virtual file system`);
      }
      const buf = Buffer.from(b64, 'base64');
      const enc =
        typeof options === 'object' && options?.encoding
          ? options.encoding
          : typeof options === 'string'
            ? options
            : undefined;
      if (enc) return buf.toString(enc);
      return buf;
    },
    writeFileSync(name: string, content: string | Buffer) {
      const k = String(name).replace(/^\//, '');
      storage[k] = Buffer.isBuffer(content) ? content.toString('base64') : Buffer.from(content).toString('base64');
    }
  };
}

const vfsAdapter = createVfsAdapter();
const urlResolver = new URLResolver(vfsAdapter);

const fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf'
  }
};

const printer = new PdfPrinter(fonts, vfsAdapter, urlResolver);

/** Макс. ширина картинки в PDF (pt), высота — с сохранением пропорций через fit */
const PDF_IMAGE_MAX_WIDTH = 440;
const PDF_IMAGE_MAX_HEIGHT = 520;

function fmtReportAt(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(s);
  }
}

function parsePhotoIds(photos: unknown): string[] {
  if (photos == null) return [];
  if (Array.isArray(photos)) return photos.map((x) => String(x));
  if (typeof photos === 'string') {
    try {
      const p = JSON.parse(photos) as unknown;
      return Array.isArray(p) ? p.map((x) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** UUID из `/api/images/:id` или полного URL */
function imageIdFromPhotoRef(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  const m = u.match(/\/api\/images\/([^/?#]+)/i);
  if (m) return m[1];
  try {
    const abs = u.startsWith('http://') || u.startsWith('https://') ? u : `http://x${u}`;
    const parsed = new URL(abs);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('images');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  } catch {
    /* ignore */
  }
  return null;
}

async function loadImageDataUrlForPdf(imageId: string): Promise<string | null> {
  const row = await dbService.getImageById(imageId);
  if (!row) return null;
  const raw = row.report_file as Buffer | Uint8Array | null | undefined;
  if (raw == null) return null;
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  if (buf.length === 0) return null;
  const mime = (row.mime_type as string) || 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function missingChecklistAnswerPlainText(item: { required?: boolean }): string {
  return item.required === false ? 'Не указано' : '—';
}

function checklistAnswerPlainText(
  item: { type?: string; label?: string; id?: string; required?: boolean },
  v: unknown
): string {
  if (v === undefined || v === null) return missingChecklistAnswerPlainText(item);
  if (item.type === 'boolean') return v ? 'Да' : 'Нет';
  if (item.type === 'photo_text' && typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>;
    const expl = typeof o.explanation === 'string' ? o.explanation.trim() : '';
    return expl || missingChecklistAnswerPlainText(item);
  }
  return String(v);
}

async function buildChecklistItemPdfBlock(
  item: { id: string; label?: string; type?: string; required?: boolean },
  v: unknown,
  baseUrl: string
): Promise<{ stack: unknown[] }> {
  const label = item.label || item.id;
  const stack: unknown[] = [{ text: label, bold: true, margin: [0, 6, 0, 2] }];

  if (item.type === 'photo_text' && v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const expl = typeof o.explanation === 'string' ? o.explanation.trim() : '';
    if (expl) {
      stack.push({ text: expl, margin: [0, 0, 0, 4] });
    }
    const urlRaw = o.photo_url ?? o.image_url ?? o.url;
    const url = typeof urlRaw === 'string' ? urlRaw.trim() : '';
    const fullUrl = url.startsWith('/') ? `${baseUrl.replace(/\/$/, '')}${url}` : url;
    const id = imageIdFromPhotoRef(url) || imageIdFromPhotoRef(fullUrl);
    if (id) {
      const dataUrl = await loadImageDataUrlForPdf(id);
      if (dataUrl) {
        stack.push({
          image: dataUrl,
          fit: [PDF_IMAGE_MAX_WIDTH, PDF_IMAGE_MAX_HEIGHT],
          margin: [0, 4, 0, 8]
        });
      } else {
        stack.push({
          text: '(Не удалось встроить изображение)',
          italics: true,
          fontSize: 9,
          color: '#666666',
          margin: [0, 0, 0, 4]
        });
      }
    } else if (!expl) {
      stack.push({ text: missingChecklistAnswerPlainText(item), margin: [0, 0, 0, 4] });
    }
    return { stack };
  }

  stack.push({ text: checklistAnswerPlainText(item, v), margin: [0, 0, 0, 4] });
  return { stack };
}

/** PDF для заказчика: текст и встроенные изображения из БД */
export async function buildOfferReportPdfBuffer(row: Record<string, unknown>, baseUrl: string): Promise<Buffer> {
  const executorLabel = typeof row.executor_label === 'string' ? row.executor_label : '—';
  const content: unknown[] = [
    { text: 'Отчёт по заданию', style: 'header' },
    { text: `Исполнитель: ${executorLabel}`, margin: [0, 6, 0, 2] },
    {
      text: `Отчёт от ${fmtReportAt(row.submitted_at as string)}`,
      fontSize: 10,
      margin: [0, 0, 0, 8]
    },
    { text: 'Статус: Принят автоматически', fontSize: 10, margin: [0, 0, 0, 12] }
  ];

  const snapshot = row.checklist_schema_snapshot as { items?: unknown[] } | null | undefined;
  const answers = row.checklist_answers as Record<string, unknown> | null | undefined;
  if (answers && snapshot?.items && Array.isArray(snapshot.items)) {
    content.push({ text: 'Ответы по чек-листу', style: 'subheader' });
    for (const it of snapshot.items as Array<{
      id: string;
      label?: string;
      type?: string;
      required?: boolean;
    }>) {
      const block = await buildChecklistItemPdfBlock(it, answers[it.id], baseUrl);
      content.push(block);
    }
  } else {
    content.push({ text: 'Стандартный отчёт', style: 'subheader' });
    if (row.rating != null) content.push({ text: `Оценка: ${row.rating} / 5`, margin: [0, 4, 0, 4] });
    const comments = row.comments;
    if (typeof comments === 'string' && comments.trim()) {
      content.push({ text: comments, margin: [0, 0, 0, 8] });
    }
    const photoIds = parsePhotoIds(row.photos);
    if (photoIds.length > 0) {
      content.push({ text: 'Фотографии', fontSize: 10, margin: [0, 8, 0, 4] });
      for (const pid of photoIds) {
        const dataUrl = await loadImageDataUrlForPdf(pid);
        if (dataUrl) {
          content.push({
            image: dataUrl,
            fit: [PDF_IMAGE_MAX_WIDTH, PDF_IMAGE_MAX_HEIGHT],
            margin: [0, 4, 0, 10]
          });
        } else {
          content.push({
            text: `(Фото ${pid}: файл недоступен)`,
            italics: true,
            fontSize: 9,
            color: '#666666',
            margin: [0, 0, 0, 6]
          });
        }
      }
    }
  }

  content.push({
    text:
      'Отчёт будет архивирован и станет недоступен для просмотра через 3 месяца с даты предоставления отчёта.',
    fontSize: 9,
    color: '#555555',
    margin: [0, 16, 0, 0]
  });

  const docDefinition = {
    content,
    styles: {
      header: { fontSize: 16, bold: true },
      subheader: { fontSize: 13, bold: true, margin: [0, 8, 0, 4] }
    },
    defaultStyle: { font: 'Roboto', fontSize: 11 }
  };

  const pdfDoc = await printer.createPdfKitDocument(docDefinition);
  const chunks: Buffer[] = [];
  return await new Promise((resolve, reject) => {
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}
