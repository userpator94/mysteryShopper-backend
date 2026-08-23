import { Resend } from 'resend';
import { config } from '../config';
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

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (!config.email.enabled) {
    console.log(`📧 Email disabled — would send to ${params.to}: ${params.subject}`);
    return;
  }

  const client = getResend();
  if (!client) {
    console.warn(`📧 RESEND_API_KEY not set — skipping email to ${params.to}`);
    return;
  }

  const { error } = await client.emails.send({
    from: config.email.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text
  });

  if (error) {
    console.error('Resend send error:', error);
    throw new Error(error.message || 'Failed to send email');
  }
}

/** Test helper */
export function resetEmailClientForTests(): void {
  resendClient = null;
}
