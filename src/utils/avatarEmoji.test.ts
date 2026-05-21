import {
  EXECUTOR_ANIMAL_EMOJIS,
  avatarEmojiFromAvatarId,
  isImageAvatarId,
  pickRandomExecutorAvatarEmoji
} from './avatarEmoji';

describe('avatarEmoji', () => {
  it('returns emoji from the known list', () => {
    const emoji = pickRandomExecutorAvatarEmoji();
    expect(EXECUTOR_ANIMAL_EMOJIS).toContain(emoji);
  });

  it('reads emoji from avatar_id when not a UUID', () => {
    expect(avatarEmojiFromAvatarId('🐶')).toBe('🐶');
    expect(isImageAvatarId('🐶')).toBe(false);
  });

  it('treats UUID avatar_id as image reference', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(isImageAvatarId(uuid)).toBe(true);
    expect(avatarEmojiFromAvatarId(uuid)).toBeNull();
  });
});
