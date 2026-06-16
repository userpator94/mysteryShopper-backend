-- Email verification and password reset tokens
CREATE TABLE IF NOT EXISTS user_auth_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL,
  purpose varchar(32) NOT NULL
    CHECK (purpose IN ('email_verification', 'password_reset')),
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_auth_tokens_active
  ON user_auth_tokens (token_hash, purpose) WHERE used_at IS NULL;

-- Existing users should not be blocked by email verification rollout
UPDATE users SET email_verified = true WHERE email_verified = false;
