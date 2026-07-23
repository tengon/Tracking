#!/usr/bin/env bash
# =============================================================
# restore-db.sh — Restore backup PostgreSQL ke Docker container
# Jalankan setelah: docker compose up -d postgres
# =============================================================
set -e

BACKUP_FILE="$(dirname "$0")/backup.dump"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: File backup tidak ditemukan: $BACKUP_FILE"
  echo "Pastikan file docker/backup.dump ada sebelum menjalankan script ini."
  exit 1
fi

echo "=== Menunggu PostgreSQL siap... ==="
until docker compose exec postgres pg_isready -U postgres -d tracking_db > /dev/null 2>&1; do
  sleep 2
done

echo "=== PostgreSQL siap. Mulai restore... ==="
docker compose exec -T postgres pg_restore \
  -U postgres \
  -d tracking_db \
  --clean \
  --if-exists \
  -v \
  < "$BACKUP_FILE"

echo "=== RESTORE SELESAI ==="
