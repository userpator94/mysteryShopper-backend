import { Resend } from 'resend';
import { config } from '../config';
import { logger, maskEmail } from '../utils/logger';
import {
  passwordChangedEmailHtml,
  passwordChangedEmailText,
  passwordResetEmailHtml,
  passwordResetEmailText,
  verificationEmailHtml,
  verificationEmailText
} from '../templates/emailTemplates';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!config.email.resendApiKey) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(config.email.resendApiKey);
  }
  return resendClient;
}

function buildFrontendUrl(path: string): string {
  const base = config.email.frontendUrl.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function sendVerificationEmail(params: {
  to: string;
  name: string;
  token: string;
}): Promise<void> {
  const verifyUrl = buildFrontendUrl(`/verify-email?token=${encodeURIComponent(params.token)}`);
  await sendEmail({
    to: params.to,
    subject: 'Подтвердите email — Mystery Shopper',
    html: verificationEmailHtml({ verifyUrl, name: params.name }),
    text: verificationEmailText({ verifyUrl, name: params.name })
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  token: string;
}): Promise<void> {
  const resetUrl = buildFrontendUrl(`/reset-password?token=${encodeURIComponent(params.token)}`);
  await sendEmail({
    to: params.to,
    subject: 'Сброс пароля — Mystery Shopper',
    html: passwordResetEmailHtml({ resetUrl, name: params.name }),
    text: passwordResetEmailText({ resetUrl, name: params.name })
  });
}

export async function sendPasswordChangedEmail(params: {
  to: string;
  name: string;
}): Promise<void> {
  const loginUrl = buildFrontendUrl('/login');
  await sendEmail({
    to: params.to,
    subject: 'Пароль изменён — Mystery Shopper',
    html: passwordChangedEmailHtml({ loginUrl, name: params.name }),
    text: passwordChangedEmailText({ loginUrl, name: params.name })
  });
}

/** Максимальное время ожидания ответа Resend на одну попытку. */
const EMAIL_SEND_TIMEOUT_MS = Number(process.env.EMAIL_SEND_TIMEOUT_MS) || 10_000;
/** Паузы перед повторными попытками в фоне (первая попытка — сразу). */
const EMAIL_RETRY_DELAYS_MS = [5_000, 30_000];

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timeout after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (!config.email.enabled) {
    logger.info({
      event: 'email.skipped',
      reason: 'disabled',
      to: maskEmail(params.to),
      subject: params.subject
    }, 'Email disabled — not sent');
    return;
  }

  const client = getResend();
  if (!client) {
    logger.warn({
      event: 'email.skipped',
      reason: 'missing_api_key',
      to: maskEmail(params.to),
      subject: params.subject
    }, 'RESEND_API_KEY not set — email skipped');
    return;
  }

  const { error } = await withTimeout(
    client.emails.send({
      from: config.email.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text
    }),
    EMAIL_SEND_TIMEOUT_MS,
    'Resend'
  );

  if (error) {
    logger.error({
      event: 'email.send_failed',
      to: maskEmail(params.to),
      subject: params.subject,
      err: error
    }, 'Resend send error');
    throw new Error(error.message || 'Failed to send email');
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Отправка письма в фоне: HTTP-ответ не ждёт Resend.
 * При сбое (недоступность, блокировка, таймаут) — несколько повторов с паузой.
 * Ошибки только логируются, наружу не пробрасываются.
 */
export function queueEmail(label: string, send: () => Promise<void>): void {
  void (async () => {
    const attempts = EMAIL_RETRY_DELAYS_MS.length + 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await send();
        if (attempt > 1) {
          logger.info({ event: 'email.sent', label, attempt }, 'Email sent after retry');
        }
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt === attempts) {
          logger.error({ event: 'email.failed', label, attempts, errorMessage: msg }, 'Email failed after retries');
          return;
        }
        logger.warn({ event: 'email.retry', label, attempt, errorMessage: msg }, 'Email attempt failed — retrying');
        await sleep(EMAIL_RETRY_DELAYS_MS[attempt - 1]);
      }
    }
  })();
}

/** Test helper */
export function resetEmailClientForTests(): void {
  resendClient = null;
}
