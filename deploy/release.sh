#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
release=$(pwd -P)
sha=${1:?Expected release commit SHA}
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || exit 1
base=/root/zahra
shared=$base/shared
[[ "$release" == "$base/releases/"* ]] || { echo 'Unexpected release path'; exit 1; }
exec 9>"$base/deploy.lock"
flock -n 9 || { echo 'Another Zahra deployment is running'; exit 1; }
test -s "$shared/storage/zahra.db"
test -d "$shared/storage/uploads"
test -f "$shared/runtime.env"
test -f "$shared/deployment.env"
docker network inspect proxy >/dev/null
export ZAHRA_IMAGE_TAG=$sha
compose() { docker compose --env-file "$shared/deployment.env" -f "$release/docker-compose.yml" "$@"; }
compose config --quiet
# Build before stopping any existing Zahra process. Never touch other Compose projects.
compose build web
old=''
if test -L "$base/current"; then
  old=$(readlink -f "$base/current")
  [[ "$old" == "$base/releases/"* ]] || exit 1
elif test -e "$base/current"; then
  echo 'Current path is not a release symlink; manual review required'; exit 1
fi
recover() {
  result=$?
  trap - ERR
  if test -n "$old"; then
    echo 'Deployment failed; restarting previous Zahra release against preserved storage.'
    compose stop web || true
    ZAHRA_IMAGE_TAG=$(cat "$old/.release-sha") docker compose --env-file "$shared/deployment.env" -f "$old/docker-compose.yml" up -d --no-build --no-deps web || true
  fi
  exit "$result"
}
trap recover ERR
if test -n "$old"; then
  ZAHRA_IMAGE_TAG=$(cat "$old/.release-sha") docker compose --env-file "$shared/deployment.env" -f "$old/docker-compose.yml" stop web
fi
# All Zahra writers must belong to this service; first deployment starts from an offline restore.
python3 "$release/deploy/backup_storage.py" "$shared/storage" "$base/backups/pre-$sha-$(date -u +%Y%m%dT%H%M%SZ)" --writers-stopped
printf '%s\n' "$sha" > "$release/.release-sha"
compose up -d --no-deps --wait --wait-timeout 180 web
ln -s "$release" "$base/current.next-$$"
mv -Tf "$base/current.next-$$" "$base/current"
trap - ERR
compose ps
printf 'Zahra release %s is healthy. Verify public DNS/TLS separately.\n' "$sha"
