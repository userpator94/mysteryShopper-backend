import fs from 'fs';
import path from 'path';
import { config } from '../config';

export type LegalOfferRole = 'user' | 'employer';

const FILENAME_BY_ROLE: Record<LegalOfferRole, string> = {
  user: 'Оферта_для_Исполнителя.pdf',
  employer: 'Оферта_для_Заказчика.pdf'
};

const ROLE_LABELS: Record<LegalOfferRole, string> = {
  user: 'Исполнитель',
  employer: 'Заказчик'
};

export function isLegalOfferRole(value: string): value is LegalOfferRole {
  return value === 'user' || value === 'employer';
}

export function getLegalOfferFilename(role: LegalOfferRole): string {
  return FILENAME_BY_ROLE[role];
}

/** Content-Disposition для PDF с кириллическим именем (RFC 5987). */
export function getLegalOfferContentDisposition(role: LegalOfferRole): string {
  const filename = FILENAME_BY_ROLE[role];
  const asciiFallback = role === 'user' ? 'offer-user.pdf' : 'offer-employer.pdf';
  const encoded = encodeURIComponent(filename);
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export function getLegalOfferVersion(): string {
  return config.legal.offerVersion;
}

export function getLegalOfferPublicUrl(role: LegalOfferRole): string {
  return `/api/legal/offers/${role}`;
}

export function getLegalOfferAdminUrl(role: LegalOfferRole): string {
  return `/api/admin/legal/docs/${role}`;
}

/** Абсолютный путь к PDF внутри LEGAL_PDFS_DIR (без path traversal). */
export function resolveLegalOfferPath(role: LegalOfferRole): string {
  const dir = path.resolve(config.legal.pdfsDir);
  const filename = FILENAME_BY_ROLE[role];
  const full = path.resolve(dir, filename);
  if (!full.startsWith(dir + path.sep) && full !== dir) {
    throw new Error('Invalid legal offer path');
  }
  return full;
}

export interface LegalOfferMeta {
  role: LegalOfferRole;
  label: string;
  filename: string;
  version: string;
  url: string;
  exists: boolean;
  size: number | null;
  mtime: string | null;
}

function buildMeta(role: LegalOfferRole, url: string): LegalOfferMeta {
  const filename = FILENAME_BY_ROLE[role];
  const version = getLegalOfferVersion();
  let exists = false;
  let size: number | null = null;
  let mtime: string | null = null;

  try {
    const filePath = resolveLegalOfferPath(role);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      exists = true;
      size = stat.size;
      mtime = stat.mtime.toISOString();
    }
  } catch {
    // файл отсутствует или каталог недоступен
  }

  return {
    role,
    label: ROLE_LABELS[role],
    filename,
    version,
    url,
    exists,
    size,
    mtime
  };
}

export function listLegalOffersPublic(): { user: LegalOfferMeta; employer: LegalOfferMeta } {
  return {
    user: buildMeta('user', getLegalOfferPublicUrl('user')),
    employer: buildMeta('employer', getLegalOfferPublicUrl('employer'))
  };
}

export function listLegalOffersAdmin(): LegalOfferMeta[] {
  return [
    buildMeta('user', getLegalOfferAdminUrl('user')),
    buildMeta('employer', getLegalOfferAdminUrl('employer'))
  ];
}

export function assertCurrentOfferVersion(version: unknown): boolean {
  return typeof version === 'string' && version.trim() === getLegalOfferVersion();
}
