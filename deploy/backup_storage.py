#!/usr/bin/env python3
"""Snapshot a confirmed Zahra storage tree after all writers have been stopped.
Does not change source. Destination must not exist. Never a restore/overwrite tool.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
from datetime import datetime, timezone


def connect_readonly(path):
    return sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)


def inspect_db(path):
    with connect_readonly(path) as db:
        integrity = [r[0] for r in db.execute('PRAGMA integrity_check')]
        if integrity != ['ok']:
            raise RuntimeError('SQLite integrity check failed')
        if db.execute('PRAGMA foreign_key_check').fetchone():
            raise RuntimeError('SQLite foreign key check failed')
        tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
        counts = {t: db.execute('SELECT count(*) FROM "' + t.replace('"', '""') + '"').fetchone()[0] for t in tables}
        return {'integrity': integrity, 'rows': counts}


def files_manifest(root):
    result = {}
    for p in sorted(root.rglob('*')):
        if p.is_symlink():
            raise RuntimeError('Symlinks require manual review: ' + str(p))
        if p.is_file():
            key = str(p.relative_to(root))
            if key in ('zahra.db', 'zahra.db-wal', 'zahra.db-shm', 'zahra.db-journal'):
                continue
            with p.open('rb') as f:
                result[key] = hashlib.file_digest(f, 'sha256').hexdigest()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--writers-stopped', action='store_true', required=True)
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    destination = args.destination.resolve()
    if source == destination or source in destination.parents or destination in source.parents:
        parser.error('Source and destination must be separate non-nested directories')
    if destination.exists():
        parser.error('Destination already exists; refusing overwrite')
    if not (source / 'zahra.db').is_file() or not (source / 'uploads').is_dir():
        parser.error('Expected existing zahra.db and uploads/')
    # Reject links before opening any file.
    before_files = files_manifest(source)
    before_db = inspect_db(source / 'zahra.db')
    os.umask(0o077)
    destination.mkdir(mode=0o700, parents=True)
    storage = destination / 'storage'
    storage.mkdir(mode=0o700)
    # SQLite online backup API includes committed WAL frames; never raw-copy a live db.
    with connect_readonly(source / 'zahra.db') as src, sqlite3.connect(storage / 'zahra.db') as dst:
        src.backup(dst)
    for entry in source.iterdir():
        if entry.name in ('zahra.db', 'zahra.db-wal', 'zahra.db-shm', 'zahra.db-journal'):
            continue
        if entry.is_dir():
            shutil.copytree(entry, storage / entry.name)
        else:
            shutil.copy2(entry, storage / entry.name)
    after_files = files_manifest(source)
    copied_files = files_manifest(storage)
    after_db = inspect_db(source / 'zahra.db')
    copied_db = inspect_db(storage / 'zahra.db')
    if before_files != after_files or before_files != copied_files or before_db != after_db or before_db != copied_db:
        raise RuntimeError('Snapshot validation failed. Keep writers stopped and investigate; do not deploy this snapshot.')
    with (storage / 'zahra.db').open('rb') as f:
        digest = hashlib.file_digest(f, 'sha256').hexdigest()
    report = {'created_utc': datetime.now(timezone.utc).isoformat(), 'database': copied_db,
              'database_sha256': digest, 'files_sha256': copied_files,
              'upload_count': sum(1 for name in copied_files if name.startswith('uploads/'))}
    (destination / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'verified': True, 'tables': len(copied_db['rows']), 'files': len(copied_files), 'uploads': report['upload_count']}))


if __name__ == '__main__':
    main()
