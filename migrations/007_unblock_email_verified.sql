-- Temporary: unblock existing users while email verification is disabled at login.
-- Safe to run multiple times. Reversible only for future signups when REQUIRE_EMAIL_VERIFICATION=true.
UPDATE users SET email_verified = true WHERE email_verified = false;
