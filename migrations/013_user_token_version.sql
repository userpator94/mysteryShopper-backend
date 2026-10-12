-- JWT revocation via token_version: bump on logout / password change
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
