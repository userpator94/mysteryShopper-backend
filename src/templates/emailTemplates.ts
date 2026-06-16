export function verificationEmailHtml(params: { verifyUrl: string; name: string }): string {
  const { verifyUrl, name } = params;
  return `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #1e293b;">
  <p>Здравствуйте${name ? `, ${escapeHtml(name)}` : ''}!</p>
  <p>Спасибо за регистрацию в Mystery Shopper. Подтвердите email, перейдя по ссылке:</p>
  <p><a href="${escapeHtml(verifyUrl)}" style="color: #2563eb;">Подтвердить email</a></p>
  <p style="color: #64748b; font-size: 14px;">Ссылка действует 24 часа. Если вы не регистрировались, проигнорируйте это письмо.</p>
</body>
</html>`.trim();
}

export function verificationEmailText(params: { verifyUrl: string; name: string }): string {
  const { verifyUrl, name } = params;
  return `Здравствуйте${name ? `, ${name}` : ''}!

Подтвердите email для Mystery Shopper:
${verifyUrl}

Ссылка действует 24 часа.`;
}

export function passwordResetEmailHtml(params: { resetUrl: string; name: string }): string {
  const { resetUrl, name } = params;
  return `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #1e293b;">
  <p>Здравствуйте${name ? `, ${escapeHtml(name)}` : ''}!</p>
  <p>Вы запросили сброс пароля для Mystery Shopper. Перейдите по ссылке, чтобы задать новый пароль:</p>
  <p><a href="${escapeHtml(resetUrl)}" style="color: #2563eb;">Сбросить пароль</a></p>
  <p style="color: #64748b; font-size: 14px;">Ссылка действует 1 час. Если вы не запрашивали сброс, проигнорируйте это письмо.</p>
</body>
</html>`.trim();
}

export function passwordResetEmailText(params: { resetUrl: string; name: string }): string {
  const { resetUrl, name } = params;
  return `Здравствуйте${name ? `, ${name}` : ''}!

Сброс пароля Mystery Shopper:
${resetUrl}

Ссылка действует 1 час.`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
