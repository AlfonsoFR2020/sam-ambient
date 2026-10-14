"""Actual CMD forwarding with a fail-closed status-only, stubbed supervisor."""

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.fixture
def checkout(tmp_path):
    root = Path(__file__).resolve().parents[2]
    executable = root / ".venv/Scripts/sam-ambient.exe"
    if os.name != "nt" or not executable.exists():
        pytest.skip("Prepared Windows checkout console entry point required")
    location = tmp_path / "Sam checkout with spaces"
    scripts = location / ".venv/Scripts"
    scripts.mkdir(parents=True)
    for name in ("Start Sam.cmd", "Diagnose Sam.cmd"):
        shutil.copyfile(root / name, location / name)
    shutil.copyfile(executable, scripts / executable.name)
    hooks = tmp_path / "isolated hooks"
    hooks.mkdir()
    # If sitecustomize is not loaded, --status below still cannot start components.
    (hooks / "sitecustomize.py").write_text(
        "import json,os\n"
        "from pathlib import Path\n"
        "from sam_ambient.supervisor import cli\n"
        "from sam_ambient.diagnostic_log import diagnostic\n"
        "async def fixture(args,root,state_db):\n"
        " Path(root/'observed.json').write_text(json.dumps(dict("
        "verbose=args.verbose,diagnostic=args.diagnostic,keep_console=args.keep_console,"
        "keep_model=args.keep_model,keep_provider=args.keep_provider,model=args.model)))\n"
        " diagnostic('fixture.launch',keep_model=args.keep_model,"
        "keep_provider=args.keep_provider)\n"
        " if os.environ.get('SAM_TEST_FAIL'):raise ValueError('PRIVATE-STARTUP-SENTINEL')\n"
        " return 0\n"
        "cli._run_locked=fixture\n",
        encoding="utf-8",
    )
    allowed = {
        "SYSTEMROOT",
        "WINDIR",
        "PATH",
        "PATHEXT",
        "COMSPEC",
        "TEMP",
        "TMP",
        "USERPROFILE",
        "HOMEDRIVE",
        "HOMEPATH",
        "SYSTEMDRIVE",
        "PROGRAMFILES",
        "PROGRAMFILES(X86)",
        "PROGRAMW6432",
        "ALLUSERSPROFILE",
        "NUMBER_OF_PROCESSORS",
        "PROCESSOR_ARCHITECTURE",
    }
    environment = {key: value for key, value in os.environ.items() if key.upper() in allowed}
    environment.update(
        PYTHONPATH=str(hooks) + os.pathsep + str(root / "src"),
        APPDATA=str(tmp_path / "appdata"),
        LOCALAPPDATA=str(tmp_path / "localappdata"),
    )
    return location, environment


def execute(checkout, name, arguments):
    root, environment = checkout
    command = f'""{root / name}" --status {arguments}"'
    return subprocess.run(
        f"cmd.exe /d /s /c {command}",
        cwd=root,
        env=environment,
        input="\n\n",
        capture_output=True,
        text=True,
        timeout=10,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )


@pytest.mark.parametrize(
    "name,flags,expected",
    [
        ("Start Sam.cmd", "--keep-console --keep-provider", (False, False, False, True)),
        (
            "Start Sam.cmd",
            '--keep-model --verbose --log-file "logs & spaces/session.jsonl"',
            (True, False, True, False),
        ),
        (
            "Diagnose Sam.cmd",
            '--verbose --keep-provider --log-file "logs & spaces/session.jsonl"',
            (True, True, False, True),
        ),
    ],
)
def test_windows_single_path_quoting_and_presets(checkout, name, flags, expected):
    result = execute(checkout, name, flags + ' --model "synthetic model with spaces"')
    assert result.returncode == 0, result.stdout + result.stderr
    root, _ = checkout
    observed = json.loads((root / "observed.json").read_text())
    assert observed["model"] == "synthetic model with spaces"
    assert (
        tuple(observed[key] for key in ("verbose", "diagnostic", "keep_model", "keep_provider"))
        == expected
    )
    assert (
        observed["keep_console"] is True
        if "--keep-console" in flags
        else observed["keep_console"] is None
    )
    if "--log-file" in flags:
        path = root / "logs & spaces/session.jsonl"
        content = path.read_text()
        assert "fixture.launch" in content and "session.summary" in content
        assert str(path.resolve()) in result.stderr
    else:
        assert not (root / ".sam/diagnostics").exists()


def test_windows_failure_is_retained_and_private_detail_not_echoed(checkout):
    root, environment = checkout
    environment["SAM_TEST_FAIL"] = "1"
    result = execute(checkout, "Diagnose Sam.cmd", '--log-file "failure logs/out.jsonl"')
    assert result.returncode == 2
    assert "Review the messages above" in result.stdout
    content = (root / "failure logs/out.jsonl").read_text()
    assert "session.summary" in content
    assert "PRIVATE-STARTUP-SENTINEL" not in content + result.stdout + result.stderr


def test_windows_unknown_argument_keeps_error_and_never_starts(checkout):
    result = execute(checkout, "Start Sam.cmd", "--verbose --not-a-sam-flag --keep-console")
    assert result.returncode == 2
    assert "unrecognized arguments" in result.stderr
    assert "Review the messages above" in result.stdout
    assert not (checkout[0] / "observed.json").exists()
