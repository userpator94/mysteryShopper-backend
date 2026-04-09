/** Текстовые поля multipart (в т.ч. дубликаты имён → массив). */
export function multipartTextField(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return multipartTextField(v[0]);
  if (typeof v === 'string') return v.trim();
  if (Buffer.isBuffer(v)) return v.toString('utf8').trim();
  return String(v).trim();
}
