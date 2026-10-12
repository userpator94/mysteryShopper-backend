import { UserRole } from '../types';

/** Нормализует роль из БД в AuthUser.role (включая admin). */
export function normalizeAuthRole(role: string | null | undefined): UserRole {
  if (role === 'employer') return 'employer';
  if (role === 'admin') return 'admin';
  return 'user';
}
