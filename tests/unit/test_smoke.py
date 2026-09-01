from sam_ambient import __version__
from sam_ambient.cli import main


def test_package_has_version() -> None:
    assert __version__ == "0.1.0"


def test_cli_reports_ready(capsys: object) -> None:
    assert main([]) == 0
    assert "chat" in capsys.readouterr().out  # type: ignore[attr-defined]
