-- Migration 223: RingCentral texts, calls and voicemail in Nexus Mail (Nov 5 2026).
-- Calls + voicemail are stored as messages with source_type 'phone' (texts use 'sms').
-- The connection itself is a message_channels row: channel_type 'phone',
-- config.provider 'ringcentral', config.jwt_enc (encrypted) — no new table.
-- Run on beta first, then prod. (ADD VALUE can't run inside a transaction with other
-- statements that use it — run this file by itself.)
ALTER TYPE message_source ADD VALUE IF NOT EXISTS 'phone';
