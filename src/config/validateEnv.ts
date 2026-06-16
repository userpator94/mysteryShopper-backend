const isProduction = process.env.NODE_ENV === 'production';

export function validateProductionEnv(): void {
  if (!isProduction) return;

  const required = ['RESEND_API_KEY', 'EMAIL_FROM', 'FRONTEND_URL', 'JWT_SECRET'] as const;
  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables for production:');
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }

  if (process.env.JWT_SECRET === 'your-secret-key') {
    console.error('❌ CRITICAL: JWT_SECRET must not use the default value in production.');
    process.exit(1);
  }
}
