#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${SSH_HOST:?Missing SSH_HOST}"
: "${SSH_USER:?Missing SSH_USER}"
: "${SSH_PRIVATE_KEY:?Missing SSH_PRIVATE_KEY}"
: "${SSH_HOST_FINGERPRINT:?Missing SSH_HOST_FINGERPRINT}"
SSH_PORT=${SSH_PORT:-22}
[[ "$SSH_PORT" =~ ^[0-9]+$ ]] || { echo 'Invalid SSH_PORT'; exit 1; }
[[ "$GITHUB_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]] || exit 1
scratch=$(mktemp -d "$RUNNER_TEMP/zahra-ssh.XXXXXX")
trap 'rm -rf "$scratch"' EXIT
# Preserve multiline key content, normalizing only Windows carriage returns.
# Neither the key nor a derived public key is written to the log.
printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' > "$scratch/key"
if ! ssh-keygen -y -P '' -f "$scratch/key" >/dev/null 2>&1; then
  echo 'SSH_PRIVATE_KEY cannot be parsed as an unencrypted OpenSSH private key. Check multiline BEGIN/END content; this workflow does not use a passphrase.'
  exit 1
fi
# Pin the host algorithm to the ED25519 fingerprint supplied during setup.
# A scanned key is untrusted until its fingerprint matches the existing Secret.
ssh-keyscan -T 15 -p "$SSH_PORT" -t ed25519 "$SSH_HOST" > "$scratch/scanned" 2>/dev/null
actual=$(ssh-keygen -lf "$scratch/scanned" -E sha256 | awk '{print $2}' | sort -u)
expected=$(printf '%s' "$SSH_HOST_FINGERPRINT" | tr -d '\r\n')
if [[ "$actual" != "$expected" ]]; then
  echo 'SSH_HOST_FINGERPRINT does not match the server ED25519 host key. No authentication or transfer attempted.'
  exit 1
fi
cp "$scratch/scanned" "$scratch/known_hosts"
options=(-i "$scratch/key" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$scratch/known_hosts" -o HostKeyAlgorithms=ssh-ed25519 -o ConnectTimeout=20)
archive="/root/zahra/incoming/source-$GITHUB_SHA-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT.tar.gz"
scp "${options[@]}" -P "$SSH_PORT" deploy-source.tar.gz "$SSH_USER@$SSH_HOST:$archive"
ssh "${options[@]}" -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" bash -s -- "$GITHUB_SHA" "$GITHUB_RUN_ID" "$GITHUB_RUN_ATTEMPT" <<'REMOTE'
set -euo pipefail
umask 077
sha=$1
run=$2
attempt=$3
[[ "$sha" =~ ^[0-9a-f]{40}$ && "$run" =~ ^[0-9]+$ && "$attempt" =~ ^[0-9]+$ ]] || exit 1
base=/root/zahra
release="$base/releases/$sha-$run-$attempt"
test -s "$base/shared/storage/zahra.db"
mkdir "$release"
tar -xzf "$base/incoming/source-$sha-$run-$attempt.tar.gz" -C "$release"
cd "$release"
bash deploy/release.sh "$sha"
REMOTE
