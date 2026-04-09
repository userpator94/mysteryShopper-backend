/** Инициалы из имени и фамилии (например для заказчика, без email). */
export function userInitials(name: unknown, surname: unknown): string {
  const n = String(name ?? '').trim();
  const s = String(surname ?? '').trim();
  const a = n.length ? n.charAt(0).toUpperCase() : '';
  const b = s.length ? s.charAt(0).toUpperCase() : '';
  const x = `${a}${b}`;
  return x || '—';
}

/**
 * Подпись исполнителя для заказчика: при наличии имя/фамилия — «ИИ · …1234», иначе «Исполнитель …1234».
 * suffix — последние символы id (маска), без ФИО целиком.
 */
export function formatExecutorMaskLabel(
  idSuffix: string,
  name?: unknown,
  surname?: unknown
): string {
  const suf = String(idSuffix ?? '').trim();
  const ini = userInitials(name, surname);
  if (ini && ini !== '—') {
    return `${ini} · …${suf}`;
  }
  return `Исполнитель …${suf}`;
}
