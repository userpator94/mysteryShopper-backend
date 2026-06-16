import { hashAuthToken, generateRawToken } from './authTokenService';

describe('authTokenService', () => {
  it('hashAuthToken is deterministic SHA-256 hex', () => {
    const raw = 'abc123';
    expect(hashAuthToken(raw)).toBe(hashAuthToken(raw));
    expect(hashAuthToken(raw)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generateRawToken returns 64-char hex string', () => {
    const t1 = generateRawToken();
    const t2 = generateRawToken();
    expect(t1).toMatch(/^[a-f0-9]{64}$/);
    expect(t2).toMatch(/^[a-f0-9]{64}$/);
    expect(t1).not.toBe(t2);
  });
});

describe('authTokenService with database', () => {
  const mockDb = {
    invalidateUserAuthTokens: jest.fn(),
    createUserAuthToken: jest.fn(),
    findActiveAuthToken: jest.fn(),
    markAuthTokenUsed: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('issueAuthToken invalidates old tokens and stores hash', async () => {
    jest.doMock('./databaseService', () => ({ dbService: mockDb }));
    const { issueAuthToken, hashAuthToken } = await import('./authTokenService');

    mockDb.invalidateUserAuthTokens.mockResolvedValue(undefined);
    mockDb.createUserAuthToken.mockResolvedValue(undefined);

    const raw = await issueAuthToken('user-1', 'email_verification');

    expect(raw).toMatch(/^[a-f0-9]{64}$/);
    expect(mockDb.invalidateUserAuthTokens).toHaveBeenCalledWith('user-1', 'email_verification');
    expect(mockDb.createUserAuthToken).toHaveBeenCalledWith(
      'user-1',
      hashAuthToken(raw),
      'email_verification',
      expect.any(Date)
    );
  });

  it('consumeAuthToken returns null for unknown token', async () => {
    jest.doMock('./databaseService', () => ({ dbService: mockDb }));
    const { consumeAuthToken } = await import('./authTokenService');

    mockDb.findActiveAuthToken.mockResolvedValue(null);

    const result = await consumeAuthToken('unknown-token', 'password_reset');
    expect(result).toBeNull();
  });

  it('consumeAuthToken marks token used and returns userId', async () => {
    jest.doMock('./databaseService', () => ({ dbService: mockDb }));
    const { consumeAuthToken, hashAuthToken } = await import('./authTokenService');

    const raw = 'a'.repeat(64);
    mockDb.findActiveAuthToken.mockResolvedValue({
      id: 'tok-1',
      user_id: 'user-42',
      expires_at: new Date(Date.now() + 60_000)
    });
    mockDb.markAuthTokenUsed.mockResolvedValue(undefined);

    const result = await consumeAuthToken(raw, 'password_reset');

    expect(mockDb.findActiveAuthToken).toHaveBeenCalledWith(hashAuthToken(raw), 'password_reset');
    expect(mockDb.markAuthTokenUsed).toHaveBeenCalledWith('tok-1');
    expect(result).toEqual({ userId: 'user-42', tokenId: 'tok-1' });
  });

  it('consumeAuthToken returns null for expired token', async () => {
    jest.doMock('./databaseService', () => ({ dbService: mockDb }));
    const { consumeAuthToken } = await import('./authTokenService');

    mockDb.findActiveAuthToken.mockResolvedValue({
      id: 'tok-2',
      user_id: 'user-42',
      expires_at: new Date(Date.now() - 1000)
    });

    const result = await consumeAuthToken('b'.repeat(64), 'email_verification');
    expect(result).toBeNull();
    expect(mockDb.markAuthTokenUsed).not.toHaveBeenCalled();
  });
});
