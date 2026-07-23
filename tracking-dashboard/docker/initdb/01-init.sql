-- =============================================================
-- init.sql — Dijalankan otomatis oleh PostgreSQL saat
--            volume pertama kali dibuat (kosong).
--            Jika restore dari backup.dump, file ini diabaikan
--            karena schema sudah ada di dump.
-- =============================================================

-- Ekstensi opsional
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Buat role readonly jika dibutuhkan (opsional)
-- CREATE ROLE readonly LOGIN PASSWORD 'readonly123';

\echo '=== PostgreSQL tracking_db initialized ==='
