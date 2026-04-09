/**
 * Валидация схемы чек-листа и ответов (согласовано с продуктовыми требованиями).
 */

export const MAX_CHECKLIST_ITEMS = Math.min(
  100,
  Math.max(1, parseInt(process.env.MAX_CHECKLIST_ITEMS || '10', 10) || 10)
);

export const CHECKLIST_TEXT_MAX_LENGTH = Math.min(
  10000,
  Math.max(100, parseInt(process.env.CHECKLIST_TEXT_MAX_LENGTH || '2000', 10) || 2000)
);

export const MAX_SINGLE_CHOICE_OPTIONS = 50;

export type ChecklistItemType = 'boolean' | 'scale_1_5' | 'text' | 'single_choice' | 'photo_text';

export interface ChecklistItem {
  id: string;
  type: ChecklistItemType;
  label: string;
  required: boolean;
  options?: string[];
}

export interface ChecklistSchema {
  items: ChecklistItem[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseChecklistSchema(raw: unknown): { ok: true; schema: ChecklistSchema | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, schema: null };
  }
  if (!isPlainObject(raw)) {
    return { ok: false, message: 'checklist_schema должен быть объектом' };
  }
  const itemsRaw = raw.items;
  if (!Array.isArray(itemsRaw)) {
    return { ok: false, message: 'checklist_schema.items должен быть массивом' };
  }
  if (itemsRaw.length === 0) {
    return { ok: false, message: 'Пустой чек-лист недопустим' };
  }
  if (itemsRaw.length > MAX_CHECKLIST_ITEMS) {
    return { ok: false, message: `Не более ${MAX_CHECKLIST_ITEMS} вопросов в чек-листе` };
  }
  const seenIds = new Set<string>();
  const items: ChecklistItem[] = [];
  for (let i = 0; i < itemsRaw.length; i++) {
    const it = itemsRaw[i];
    if (!isPlainObject(it)) {
      return { ok: false, message: `Элемент ${i + 1}: неверный формат` };
    }
    const id = typeof it.id === 'string' ? it.id.trim() : '';
    if (!id || id.length > 64) {
      return { ok: false, message: `Элемент ${i + 1}: id обязателен (строка до 64 символов)` };
    }
    if (seenIds.has(id)) {
      return { ok: false, message: `Дублируется id вопроса: ${id}` };
    }
    seenIds.add(id);
    const type = it.type as string;
    if (!['boolean', 'scale_1_5', 'text', 'single_choice', 'photo_text'].includes(type)) {
      return { ok: false, message: `Элемент ${i + 1}: неизвестный type` };
    }
    const label = typeof it.label === 'string' ? it.label.trim() : '';
    if (!label || label.length > 500) {
      return { ok: false, message: `Элемент ${i + 1}: label обязателен` };
    }
    const required = Boolean(it.required);
    let options: string[] | undefined;
    if (type === 'single_choice') {
      if (!Array.isArray(it.options) || it.options.length < 2) {
        return { ok: false, message: `Вопрос ${id}: для single_choice нужно минимум 2 варианта` };
      }
      options = it.options.map((o) => String(o).trim()).filter(Boolean);
      if (options.length < 2 || options.length > MAX_SINGLE_CHOICE_OPTIONS) {
        return { ok: false, message: `Вопрос ${id}: неверное число вариантов` };
      }
    }
    items.push({ id, type: type as ChecklistItemType, label, required, options });
  }
  return { ok: true, schema: { items } };
}

export type ChecklistAnswers = Record<string, unknown>;

export function validateAnswersAgainstSchema(
  schema: ChecklistSchema,
  answers: unknown
): { ok: true; answers: ChecklistAnswers } | { ok: false; message: string; field?: string } {
  if (!isPlainObject(answers)) {
    return { ok: false, message: 'answers должен быть объектом' };
  }
  const out: ChecklistAnswers = {};
  for (const item of schema.items) {
    const v = answers[item.id];
    if (v === undefined || v === null || v === '') {
      if (item.required) {
        return { ok: false, message: `Обязательный ответ: ${item.label}`, field: item.id };
      }
      continue;
    }
    switch (item.type) {
    case 'boolean': {
      if (typeof v !== 'boolean') {
        return { ok: false, message: `Ожидается да/нет: ${item.label}`, field: item.id };
      }
      out[item.id] = v;
      break;
    }
    case 'scale_1_5': {
      const n = typeof v === 'string' ? parseInt(v, 10) : typeof v === 'number' ? v : NaN;
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return { ok: false, message: `Шкала 1–5: ${item.label}`, field: item.id };
      }
      out[item.id] = n;
      break;
    }
    case 'text': {
      const s = String(v);
      if (s.length > CHECKLIST_TEXT_MAX_LENGTH) {
        return { ok: false, message: `Текст слишком длинный: ${item.label}`, field: item.id };
      }
      out[item.id] = s;
      break;
    }
    case 'single_choice': {
      const s = String(v);
      if (!item.options?.includes(s)) {
        return { ok: false, message: `Неверный вариант: ${item.label}`, field: item.id };
      }
      out[item.id] = s;
      break;
    }
    case 'photo_text': {
      if (!isPlainObject(v)) {
        return { ok: false, message: `Ожидается объект с полем explanation: ${item.label}`, field: item.id };
      }
      const expl = typeof v.explanation === 'string' ? v.explanation.trim() : '';
      if (!expl) {
        return { ok: false, message: `Заполните пояснение к фото: ${item.label}`, field: item.id };
      }
      if (expl.length > CHECKLIST_TEXT_MAX_LENGTH) {
        return { ok: false, message: `Текст слишком длинный: ${item.label}`, field: item.id };
      }
      out[item.id] = { explanation: expl };
      break;
    }
    default:
      return { ok: false, message: 'Внутренняя ошибка типа вопроса' };
    }
  }
  for (const key of Object.keys(answers)) {
    if (!schema.items.some((i) => i.id === key)) {
      return { ok: false, message: `Неизвестный вопрос: ${key}` };
    }
  }
  return { ok: true, answers: out };
}
