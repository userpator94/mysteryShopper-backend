import type { Request } from 'express';

/**
 * Достаёт boundary из первых байтов тела (если прокси убрал/испортил Content-Type).
 * Формат: строка начинается с `--<boundary>` или после CRLF.
 */
export function extractBoundaryFromBody(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  const head = buf.subarray(0, Math.min(buf.length, 8192)).toString('latin1');
  const m = head.match(/^--([^\r\n]{1,300})/);
  if (m) return m[1];
  const m2 = head.match(/\r\n--([^\r\n]{1,300})/);
  return m2 ? m2[1] : null;
}

/**
 * Если в заголовке нет валидного multipart/form-data; boundary=…, подставляет boundary из тела.
 */
export function ensureMultipartContentType(req: Pick<Request, 'headers'>, buf: Buffer): void {
  const raw = req.headers['content-type'];
  const ct = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  if (ct && ct.toLowerCase().includes('multipart/form-data') && /boundary\s*=/i.test(ct)) {
    return;
  }
  const b = extractBoundaryFromBody(buf);
  if (!b) {
    throw new Error('MULTIPART_BOUNDARY_MISSING');
  }
  req.headers['content-type'] = `multipart/form-data; boundary=${b}`;
}
