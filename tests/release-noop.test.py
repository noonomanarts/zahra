"""Exercise the real shell gate with a disposable fake deployment root and Docker stub."""
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
class ReleaseNoop(unittest.TestCase):
    def test_healthy_same_commit_does_not_build_stop_or_touch_storage(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d).resolve()/'zahra'; release=base/'releases'/'fixture'; release.mkdir(parents=True)
            shared=base/'shared'; (shared/'storage/uploads').mkdir(parents=True)
            (shared/'runtime.env').touch(); (shared/'deployment.env').touch()
            sha='a'*40
            (release/'.release-sha').write_text(sha+'\n'); (base/'current').symlink_to(release)
            shutil.copytree(ROOT/'db/migrations',release/'db/migrations')
            (release/'deploy').mkdir(); shutil.copy(ROOT/'deploy/check_schema.py',release/'deploy/check_schema.py')
            database=shared/'storage/zahra.db'
            with sqlite3.connect(database) as c:
                c.execute('CREATE TABLE __drizzle_migrations (hash TEXT,created_at INTEGER)')
                for e in json.loads((ROOT/'db/migrations/meta/_journal.json').read_text())['entries']:
                    c.execute('INSERT INTO __drizzle_migrations VALUES (?,?)',(hashlib.sha256((ROOT/'db/migrations'/(e['tag']+'.sql')).read_bytes()).hexdigest(),e['when']))
            script=(ROOT/'deploy/release.sh').read_text().replace('base=/root/zahra',f'base={base}')
            (release/'deploy/release.sh').write_text(script)
            binpath=Path(d)/'bin'; binpath.mkdir()
            (binpath/'docker').write_text('#!/bin/sh\n[ "$1" = inspect ] || exit 99\nprintf "zahra:'+sha+' healthy\\n"\n')
            (binpath/'docker').chmod(0o700)
            # macOS does not provide flock; only the temporary test lock is stubbed.
            (binpath/'flock').write_text('#!/bin/sh\nexit 0\n'); (binpath/'flock').chmod(0o700)
            before=database.read_bytes()
            result=subprocess.run(['bash','deploy/release.sh',sha],cwd=release,env={'PATH':str(binpath)+':/opt/homebrew/bin:/usr/bin:/bin'},capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertIn('already healthy',result.stdout)
            self.assertEqual(before,database.read_bytes())
if __name__=='__main__': unittest.main()
