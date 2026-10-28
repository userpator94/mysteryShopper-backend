/**
 * Parses CORS_ORIGIN into a list of allowed origins.
 * Supports comma-separated values with optional spaces; strips trailing slashes.
 */
export function getAllowedOrigins(envValue = process.env.CORS_ORIGIN): string[] {
  if (envValue === undefined || envValue.trim() === '') {
    return ['http://localhost:3000'];
  }

  const origins = envValue
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : ['http://localhost:3000'];
}

/** Returns true if the request Origin is allowed (missing Origin is allowed). */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[] = getAllowedOrigins()
): boolean {
  if (!origin) {
    return true;
  }
  return allowedOrigins.includes(origin);
}
