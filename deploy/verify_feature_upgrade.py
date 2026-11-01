#!/usr/bin/env python3
"""Bounded verification for the 0003/content release; never emits row contents."""
import json
from pathlib import Path
import sqlite3
import sys


def connect(path):
    c = sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)
    assert c.execute('PRAGMA integrity_check').fetchone() == ('ok',), 'integrity check failed'
    assert not c.execute('PRAGMA foreign_key_check').fetchall(), 'foreign key check failed'
    return c


def columns(c, table):
    return [r[1] for r in c.execute(f'PRAGMA table_info("{table}")')]


def rows(c, table, cols):
    fields = ','.join('"' + col + '"' for col in cols)
    return set(c.execute(f'SELECT {fields} FROM "{table}"'))


def verify(before, after):
    a, b = connect(before), connect(after)
    tables = [r[0] for r in a.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    for table in tables:
        if table in ('sqlite_sequence', 'settings', 'pages'):
            continue
        old = rows(a, table, columns(a, table))
        new = rows(b, table, columns(a, table))
        if table in ('categories', 'product_categories', '__drizzle_migrations'):
            assert old <= new, f'Existing {table} changed or removed'
        else:
            assert old == new, f'Protected {table} changed'
    for table in ('finance_entries', 'service_requests', 'workshop_grants'):
        if table in tables:
            assert rows(a, table, columns(a, table)) == rows(b, table, columns(a, table)), f'{table} changed'
        else:
            assert b.execute(f'SELECT count(*) FROM {table}').fetchone()[0] == 0, f'Unexpected {table} records'
    protected_page_cols = [c for c in columns(a, 'pages') if c not in ('title_ar', 'blocks', 'updated_at')]
    assert rows(a, 'pages', protected_page_cols) <= rows(b, 'pages', protected_page_cols), 'Page metadata lost'
    new_pages = dict(b.execute('SELECT id,title_ar FROM pages'))
    for pid, ar in a.execute('SELECT id,title_ar FROM pages'):
        if ar.strip():
            assert new_pages[pid] == ar, 'Existing Arabic title changed'
    allowed = {'mainMenu','footerMenus','whatsapp','social','tagline','printService'}
    after_settings = dict(b.execute('SELECT key,value FROM settings'))
    for key, value in a.execute('SELECT key,value FROM settings'):
        assert key in after_settings, 'Setting removed'
        if key != 'site':
            assert value == after_settings[key], 'Private setting changed'
            continue
        old, new = json.loads(value), json.loads(after_settings[key])
        assert {k:v for k,v in old.items() if k not in allowed} == {k:v for k,v in new.items() if k not in allowed}, 'Protected site settings changed'
    report = {t: b.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0] for t in ('products','categories','product_categories','pages','customers','orders','admin_users','sessions','__drizzle_migrations')}
    print(json.dumps({'verified': True, 'preserved': 'all original products, customers, orders, authentication, tags, category links and protected settings', 'counts': report}))


if __name__ == '__main__':
    verify(sys.argv[1], sys.argv[2])
