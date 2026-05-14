/** Статус отчёта для API (фронт). */
export type ApiReportStatus = 'pending_review' | 'approved' | 'rejected';

export function mapReportRowToApiStatus(row: {
  payment_status?: string | null;
  is_approved?: boolean | null;
}): ApiReportStatus {
  const ps = String(row.payment_status || '').toLowerCase();
  if (ps === 'rejected') return 'rejected';
  if (ps === 'paid' && row.is_approved === true) return 'approved';
  return 'pending_review';
}

/** Минимум 10 слов для комментария отказа в отчёте (токены по пробелам и переводам строк). */
export function countWordsInComment(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

export function withReportApiFields<T extends Record<string, unknown>>(
  row: T
): T & { report_status: ApiReportStatus } {
  const payment_status = row.payment_status as string | undefined;
  const is_approved = row.is_approved as boolean | undefined;
  return {
    ...row,
    report_status: mapReportRowToApiStatus({ payment_status, is_approved })
  };
}
