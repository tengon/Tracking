-- =============================================================
-- init.sql — Dijalankan otomatis oleh PostgreSQL saat
--            volume pertama kali dibuat (kosong).
--            Jika restore dari backup.dump, file ini diabaikan
--            karena schema sudah ada di dump.
-- =============================================================

-- Ekstensi opsional
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table accounts dengan detail fields jimi.user.child.list
CREATE TABLE IF NOT EXISTS accounts (
  account TEXT PRIMARY KEY,
  parent_account TEXT,
  name TEXT,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  type INT DEFAULT 0,
  display_flag INT DEFAULT 1,
  address TEXT,
  birth TEXT,
  language TEXT,
  sex INT DEFAULT 0,
  enabled_flag INT DEFAULT 1,
  enabled INT DEFAULT 1,
  remark TEXT,
  user_id TEXT,
  parent_id TEXT,
  raw_detail JSONB,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_account);

\echo '=== PostgreSQL tracking_db initialized ==='
