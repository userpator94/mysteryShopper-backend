/** UUID в avatar_id — ссылка на images.id; иначе в поле хранится символ эмодзи. */
const IMAGE_AVATAR_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Условие JOIN images по avatar_id (только UUID). */
export const PG_AVATAR_ID_IS_IMAGE_UUID =
  'avatar_id ~ \'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$\'';

/** Набор животных-эмодзи для аватара исполнителя (согласовано с фронтом). */
export const EXECUTOR_ANIMAL_EMOJIS: readonly string[] = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
  '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
  '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
  '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦀', '🐡',
  '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓',
  '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦡',
  '🦔', '🐾', '🦃', '🦤', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇',
  '🐿️', '🦨', '🦦', '🦥', '🦫', '🐀', '🐁', '🐂', '🐃', '🐄',
  '🐖', '🐏', '🐑', '🐐', '🦌', '🐕', '🐩', '🐈', '🐈‍⬛', '🪶'
] as const;

export function pickRandomExecutorAvatarEmoji(): string {
  const list = EXECUTOR_ANIMAL_EMOJIS;
  return list[Math.floor(Math.random() * list.length)]!;
}

export function isImageAvatarId(avatarId: string | null | undefined): boolean {
  if (avatarId == null || String(avatarId).trim() === '') return false;
  return IMAGE_AVATAR_ID_RE.test(String(avatarId).trim());
}

/** Эмодзи из users.avatar_id (если там не UUID картинки). */
export function avatarEmojiFromAvatarId(avatarId: string | null | undefined): string | null {
  if (isImageAvatarId(avatarId)) return null;
  const v = avatarId != null ? String(avatarId).trim() : '';
  return v || null;
}

export function resolveUserAvatarFields(
  avatarId: string | null | undefined,
  imageUrl?: string | null
): { avatar_url: string | null; avatar_emoji: string | null } {
  return {
    avatar_url: isImageAvatarId(avatarId) ? (imageUrl?.trim() || null) : null,
    avatar_emoji: avatarEmojiFromAvatarId(avatarId)
  };
}
