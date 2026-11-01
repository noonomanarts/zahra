#!/usr/bin/env python3
"""Read-only gate: ordinary deployments never apply production migrations."""
import hashlib
import json
from pathlib import Path
import sqlite3
import sys


def check(database, migrations):
    folder = Path(migrations)
    entries = json.loads((folder / 'meta/_journal.json').read_text())['entries']
    expected = [(hashlib.sha256((folder / (e['tag'] + '.sql')).read_bytes()).hexdigest(), e['when']) for e in entries]
    with sqlite3.connect(Path(database).resolve().as_uri() + '?mode=ro', uri=True) as connection:
        actual = connection.execute('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at').fetchall()
    if actual != expected:
        raise SystemExit('Database schema differs from this release. Stop: rehearse and apply reviewed migrations with a fresh server backup before deploying. No data changed.')
    print('Production schema matches release migrations.')


if __name__ == '__main__':
    check(sys.argv[1], sys.argv[2])
