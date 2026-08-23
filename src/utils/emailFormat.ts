/** Unquoted local-part atext (RFC 5322) and domain labels. Allows `+`, no spaces/IDN. */
const EMAIL_ATEXT_AND_DOT = '[a-zA-Z0-9.!#$%&\'*+/=?^_`{|}~-]';
const EMAIL_DOMAIN_LABEL =
  '[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?';

export const EMAIL_FORMAT_REGEX = new RegExp(
  `^${EMAIL_ATEXT_AND_DOT}+@${EMAIL_DOMAIN_LABEL}(?:\\.${EMAIL_DOMAIN_LABEL})+$`
);

export const EMAIL_ALLOWED_CHARS_REGEX = new RegExp(
  '^[a-zA-Z0-9.!#$%&\'*+/=?^_`{|}~@-]*$'
);

export function isValidEmailFormat(email: string): boolean {
  const value = email.trim();
  if (!value || value.length > 254) return false;
  const at = value.lastIndexOf('@');
  if (at <= 0 || at !== value.indexOf('@')) return false;
  const local = value.slice(0, at);
  if (local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  return EMAIL_FORMAT_REGEX.test(value);
}
