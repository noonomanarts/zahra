# Zahra Docker deployment

Zahra uses SQLite and uploads under `/app/storage`. It runs as UID/GID 1001 on the
existing external `proxy` network. It neither creates a database nor seeds data on
startup. Noon and other Compose projects are not managed by this deployment.

## Server preparation

Use existing authenticated SSH access and verify the host key. Inspect destination
paths before creating `/root/zahra/{shared,backups,incoming,releases}`. Never overwrite
an existing database. Restore a verified, consistent snapshot into
`/root/zahra/shared/storage`, with ownership scoped to UID/GID 1001 for that copy.
Keep original source and private backups. `storage/uploads` must exist, even if empty.

Create private `/root/zahra/shared/runtime.env` from `deploy/runtime.env.example`,
preserving existing payment configuration. Administrator credentials and sessions
are in the restored database; do not run `db:seed` or `db:setup` against it.

Create private `/root/zahra/shared/deployment.env` containing:

```dotenv
ZAHRA_STORAGE_DIR=/root/zahra/shared/storage
ZAHRA_DOMAIN=zahra.noonomanarts.com
# Set to the confirmed domain only after DNS resolves to this server.
ZAHRA_TLS_HOST=
```

Confirm the exact domain with the owner. Never substitute another hostname. Empty
`ZAHRA_TLS_HOST` disables certificate requests while internal app verification can
continue. After correct A/AAAA records are verified, set it to the confirmed domain
and rerun the deployment to enable the existing ACME companion.

## GitHub Actions

The main-branch workflow and manual dispatch use existing repository Secrets:
`SSH_HOST`, `SSH_USER`, `SSH_PORT` (defaults to 22), `SSH_PRIVATE_KEY`, and
`SSH_HOST_FINGERPRINT`. No passphrase is required for the configured identity.
These names are references only; never commit their values.

The workflow rejects tracked private files, archives tracked source only, transfers
it over host-verified SSH, and builds on the server. Each run gets a new release
directory and an image tagged with the commit SHA. Action versions are pinned.
Shared data and runtime secrets are never part of the source archive or Docker image.
The image build migrates only a disposable empty schema. Production schema migrations
must be separately reviewed and tested on a disposable backup before application.

`deploy/release.sh` takes a deployment lock and builds before stopping any existing
Zahra service. It stops only Zahra for a consistent pre-release storage backup, starts
and waits for the new service, then atomically updates `/root/zahra/current`. On failure
it attempts to restart the previous release against preserved storage. No volumes
or databases are deleted. Public TLS must still be verified independently.

## Consistent backups

Stop all Zahra writers, then run (Python 3.11+):

```sh
python3 deploy/backup_storage.py /confirmed/storage /new/private/snapshot --writers-stopped
```

The flag asserts that writers are already stopped; the helper does not stop them.
SQLite's backup API handles committed WAL frames. The helper checks integrity,
foreign keys, row counts and hashes of every copied file, including older backups.
It rejects symlinks and existing destinations. An incomplete/failed snapshot must
not be deployed. Compare manifest hashes and counts again after SSH transfer.

## Verification and rollback

Verify container health, `/api/health`, both locales, a known product, sitemap,
admin sign-in, and an upload if any. Check the actual HTTPS hostname without disabling
certificate validation. Compare restored DB counts with the transfer manifest and
confirm Noon's public endpoint and container baseline remain unchanged.

For rollback, stop only Zahra and select the previous release/image. Do not overwrite
current data; restore into a new directory only after reconciling writes since cutover.
Never prune shared Docker resources or run `docker compose down -v`.
