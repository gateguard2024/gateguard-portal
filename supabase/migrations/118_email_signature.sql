-- Migration 118: per-user email signature, appended to outbound mail.
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS email_signature text;
