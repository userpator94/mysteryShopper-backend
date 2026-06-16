import crypto from 'crypto';
import { dbService } from './databaseService';

export type AuthTokenPurpose = 'email_verification' | 'password_reset';

const TTL_MS: Record<AuthTokenPurpose, number> = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000
};

export function hashAuthToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function issueAuthToken(userId: string, purpose: AuthTokenPurpose): Promise<string> {
  const rawToken = generateRawToken();
  const tokenHash = hashAuthToken(rawToken);
  const expiresAt = new Date(Date.now() + TTL_MS[purpose]);

  await dbService.invalidateUserAuthTokens(userId, purpose);
  await dbService.createUserAuthToken(userId, tokenHash, purpose, expiresAt);

  return rawToken;
}

export async function consumeAuthToken(
  rawToken: string,
  purpose: AuthTokenPurpose
): Promise<{ userId: string; tokenId: string } | null> {
  const tokenHash = hashAuthToken(rawToken);
  const row = await dbService.findActiveAuthToken(tokenHash, purpose);
  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }

  await dbService.markAuthTokenUsed(row.id);
  return { userId: row.user_id, tokenId: row.id };
}
