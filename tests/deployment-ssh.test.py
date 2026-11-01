"""Exercise SSH checks with fake inputs and commands; never connect or read credentials."""
import os
from pathlib import Path
import subprocess
import tempfile

script = Path(__file__).resolve().parents[1] / 'deploy/ci-ssh.sh'
with tempfile.TemporaryDirectory(prefix='zahra-ci-check-') as directory:
    root = Path(directory)
    bin_dir = root / 'bin'
    bin_dir.mkdir()
    stubs = {
        'ssh-keygen': '''#!/bin/bash
if [[ "$1" == '-y' ]]; then exit "${KEY_RESULT:-0}"; fi
printf '256 SHA256:fixture host (ED25519)\\n'
''',
        'ssh-keyscan': '#!/bin/bash\nprintf "fixture-host ssh-ed25519 fixture-public-key\\n"\n',
        'scp': '#!/bin/bash\nprintf "scp\\n" >> "$CALL_LOG"\n',
        'ssh': '#!/bin/bash\ncat >/dev/null\nprintf "ssh\\n" >> "$CALL_LOG"\n',
    }
    for name, body in stubs.items():
        p = bin_dir / name
        p.write_text(body)
        p.chmod(0o700)
    for name, key_result, fingerprint, expected_code, expected_calls in [
        ('invalid key', '1', 'SHA256:fixture', 1, []),
        ('wrong host', '0', 'SHA256:wrong', 1, []),
        ('verified host', '0', 'SHA256:fixture', 0, ['scp', 'ssh']),
    ]:
        log = root / 'calls'
        log.write_text('')
        env = {**os.environ, 'PATH': f'{bin_dir}:{os.environ["PATH"]}',
               'RUNNER_TEMP': str(root), 'CALL_LOG': str(log),
               'SSH_HOST': 'fixture.invalid', 'SSH_USER': 'fixture', 'SSH_PORT': '22',
               'SSH_PRIVATE_KEY': 'fake-test-value', 'SSH_HOST_FINGERPRINT': fingerprint,
               'GITHUB_SHA': 'a' * 40, 'GITHUB_RUN_ID': '1', 'GITHUB_RUN_ATTEMPT': '1',
               'KEY_RESULT': key_result}
        result = subprocess.run(['bash', str(script)], env=env, capture_output=True, text=True)
        assert result.returncode == expected_code, (name, result.stderr)
        assert log.read_text().splitlines() == expected_calls, name
        assert not list(root.glob('zahra-ssh.*')), 'Temporary key directory was not cleaned'
        assert 'fake-test-value' not in result.stdout + result.stderr
        print('PASS:', name)
