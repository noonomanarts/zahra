import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import sys
sys.dont_write_bytecode = True
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('schema_gate', ROOT / 'deploy/check_schema.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

class SchemaGateTests(unittest.TestCase):
    def test_pending_and_modified_migrations_block_without_changing_database(self):
        with tempfile.TemporaryDirectory() as folder:
            database = Path(folder) / 'fixture.db'
            entries = json.loads((ROOT / 'db/migrations/meta/_journal.json').read_text())['entries']
            with sqlite3.connect(database) as c:
                c.execute('CREATE TABLE __drizzle_migrations (hash TEXT, created_at INTEGER)')
                for e in entries[:-1]:
                    c.execute('INSERT INTO __drizzle_migrations VALUES (?,?)', (hashlib.sha256((ROOT / 'db/migrations' / (e['tag']+'.sql')).read_bytes()).hexdigest(),e['when']))
            before = database.read_bytes()
            with self.assertRaises(SystemExit):
                gate.check(database, ROOT / 'db/migrations')
            self.assertEqual(before, database.read_bytes())
            e = entries[-1]
            with sqlite3.connect(database) as c:
                c.execute('INSERT INTO __drizzle_migrations VALUES (?,?)', (hashlib.sha256((ROOT / 'db/migrations' / (e['tag']+'.sql')).read_bytes()).hexdigest(),e['when']))
            gate.check(database, ROOT / 'db/migrations')
            with sqlite3.connect(database) as c:
                c.execute("UPDATE __drizzle_migrations SET hash='changed' WHERE created_at=?", (e['when'],))
            with self.assertRaises(SystemExit):
                gate.check(database, ROOT / 'db/migrations')

if __name__ == '__main__':
    unittest.main()
