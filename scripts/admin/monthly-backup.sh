#!/usr/bin/env bash
# scripts/admin/monthly-backup.sh — ChampStep monthly offsite backup (docs/BACKUP.md §B).
#
#   bash scripts/admin/monthly-backup.sh            # run
#   DRY_RUN=1 bash scripts/admin/monthly-backup.sh  # print the commands only
#
# 1. Firestore export  → gs://$BACKUP_BUCKET/firestore/YYYYMMDD   (skipped when that prefix exists)
# 2. Storage rsync     → gs://$BACKUP_BUCKET/storage               (never -d: deletions are not mirrored)
# 3. Auth export       → $AUTH_DIR/auth-YYYYMMDD.json               (outside the repo; contains password hashes)
# Idempotent, stops on the first error, prints no secrets. Needs: gcloud + gsutil (logged in), npx.
set -euo pipefail

PROJECT="champstep-22358"
BACKUP_BUCKET="champstep-22358-backups"
STORAGE_BUCKET="champstep-22358.firebasestorage.app"
DATABASE="(default)"
AUTH_DIR="$HOME/ChampStep-backups"
STAMP="$(date +%Y%m%d)"
DRY_RUN="${DRY_RUN:-0}"

run() {
  if [ "$DRY_RUN" = "1" ]; then printf '[dry-run] %s\n' "$*"; else "$@"; fi
}

for bin in gcloud gsutil npx; do
  command -v "$bin" >/dev/null 2>&1 || { echo "missing: $bin (see docs/BACKUP.md §0)" >&2; exit 2; }
done
current="$(gcloud config get-value project 2>/dev/null || true)"
if [ "$current" != "$PROJECT" ]; then
  echo "gcloud project is '$current', expected '$PROJECT' — run: gcloud config set project $PROJECT" >&2
  exit 2
fi
if ! gsutil ls -b "gs://$BACKUP_BUCKET" >/dev/null 2>&1; then
  echo "backup bucket gs://$BACKUP_BUCKET not found — create it first (docs/BACKUP.md §B1)" >&2
  exit 2
fi

echo "== 1/3 Firestore export → gs://$BACKUP_BUCKET/firestore/$STAMP"
if gsutil -q stat "gs://$BACKUP_BUCKET/firestore/$STAMP/*.overall_export_metadata" 2>/dev/null; then
  echo "   already exists for $STAMP — skipped"
else
  run gcloud firestore export "gs://$BACKUP_BUCKET/firestore/$STAMP" --database="$DATABASE" --project="$PROJECT"
fi

echo "== 2/3 Storage rsync gs://$STORAGE_BUCKET → gs://$BACKUP_BUCKET/storage (no -d)"
run gsutil -m -q rsync -r "gs://$STORAGE_BUCKET" "gs://$BACKUP_BUCKET/storage"

echo "== 3/3 Auth export → $AUTH_DIR/auth-$STAMP.json"
run mkdir -p "$AUTH_DIR"
run chmod 700 "$AUTH_DIR"
if [ -s "$AUTH_DIR/auth-$STAMP.json" ]; then
  echo "   already exists for $STAMP — skipped"
else
  run npx firebase-tools auth:export "$AUTH_DIR/auth-$STAMP.json" --project "$PROJECT" --format=json
  run chmod 600 "$AUTH_DIR/auth-$STAMP.json"
fi

echo "== done"
if [ "$DRY_RUN" != "1" ]; then
  echo "firestore: $(gsutil ls "gs://$BACKUP_BUCKET/firestore/" | tail -3 | tr '\n' ' ')"
  echo "storage:   $(gsutil du -sh "gs://$BACKUP_BUCKET/storage" 2>/dev/null | awk '{print $1, $2}')"
  echo "auth:      $(ls -l "$AUTH_DIR/auth-$STAMP.json" | awk '{print $5 " bytes"}')"
fi
