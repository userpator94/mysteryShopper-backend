import { verificationEmailHtml, passwordResetEmailHtml } from '../templates/emailTemplates';

describe('emailTemplates', () => {
  it('verificationEmailHtml includes link and escapes name', () => {
    const html = verificationEmailHtml({
      verifyUrl: 'https://app.test/verify-email?token=abc',
      name: '<script>'
    });
    expect(html).toContain('https://app.test/verify-email?token=abc');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('passwordResetEmailHtml includes reset link', () => {
    const html = passwordResetEmailHtml({
      resetUrl: 'https://app.test/reset-password?token=xyz',
      name: 'Ivan'
    });
    expect(html).toContain('https://app.test/reset-password?token=xyz');
    expect(html).toContain('Ivan');
  });
});
