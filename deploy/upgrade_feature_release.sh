#!/usr/bin/env bash
# Explicit operator command for the reviewed 0003/content upgrade, not called by CI.
set -Eeuo pipefail
umask 077
release=$(pwd -P)
sha=${1:?Expected release SHA}
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || exit 1
base=/root/zahra
shared=$base/shared
[[ "$release" == "$base/releases/"* ]] || exit 1
[[ "${2:-}" == --reviewed-server-copy ]] || { echo 'Rehearse on a fresh server copy before this explicit maintenance command.'; exit 1; }
exec 9>"$base/deploy.lock"
flock -n 9 || { echo 'Another Zahra deployment is running'; exit 1; }
old=$(readlink -f "$base/current")
[[ "$old" == "$base/releases/"* ]] || exit 1
test -s "$shared/storage/zahra.db"
export ZAHRA_IMAGE_TAG=$sha
compose() { docker compose --env-file "$shared/deployment.env" -f "$release/docker-compose.yml" "$@"; }
compose config --quiet
# No maintenance until both images have built successfully; private data excluded from context.
compose build web
docker build --target builder -t "zahra-tools:$sha" .
backup="$base/backups/pre-feature-$sha-$(date -u +%Y%m%dT%H%M%SZ)"
recover() {
  result=$?
  trap - ERR INT TERM HUP
  echo 'Upgrade failed. Retaining backup and current database; restarting the previous compatible application.'
  compose stop web || true
  ZAHRA_IMAGE_TAG=$(cat "$old/.release-sha") docker compose --env-file "$shared/deployment.env" -f "$old/docker-compose.yml" up -d --no-build --no-deps web || true
  exit "$result"
}
trap recover ERR INT TERM HUP
ZAHRA_IMAGE_TAG=$(cat "$old/.release-sha") docker compose --env-file "$shared/deployment.env" -f "$old/docker-compose.yml" stop web
python3 deploy/backup_storage.py "$shared/storage" "$backup" --writers-stopped
# Only this server's existing database is migrated. No local DB, seed, reset, or restore.
docker run --rm --network none --read-only --user 1001:1001 --cap-drop ALL --security-opt no-new-privileges \
  --memory 2g --cpus 2 --pids-limit 256 --tmpfs /tmp:rw,size=256m \
  --mount "type=bind,source=$shared/storage,target=/app/storage" \
  -e DATABASE_URL=file:/app/storage/zahra.db "zahra-tools:$sha" \
  sh -c 'node --import tsx scripts/migrate.mts && node --import tsx scripts/upgrade-content.mts'
python3 deploy/verify_feature_upgrade.py "$backup/storage/zahra.db" "$shared/storage/zahra.db"
python3 - "$backup" "$shared/storage" <<'PY'
import json, sys
from pathlib import Path
sys.path.insert(0, 'deploy')
from backup_storage import files_manifest
assert json.loads((Path(sys.argv[1]) / 'manifest.json').read_text())['files_sha256'] == files_manifest(Path(sys.argv[2])), 'Stored files changed during upgrade'
print('All uploaded/private files and historical backups preserved.')
PY
python3 deploy/check_schema.py "$shared/storage/zahra.db" db/migrations
printf '%s\n' "$sha" > .release-sha
compose up -d --no-build --no-deps --wait --wait-timeout 180 web
ln -s "$release" "$base/current.next-$$"
mv -Tf "$base/current.next-$$" "$base/current"
trap - ERR INT TERM HUP
printf 'Upgraded Zahra release %s is healthy. Backup: %s\n' "$sha" "$backup"
