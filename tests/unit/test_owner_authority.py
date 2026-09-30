import io
import json
import sys

import pytest

from sam_ambient.core.owner import OwnerAuthorityError, OwnerSession, read_owner_bootstrap
from sam_ambient.supervisor.owner_window import OwnerWindow


def test_mutual_connection_proof_rotation_and_secret_redaction(caplog):
    owner = OwnerSession()
    first = owner.challenge("core-1")
    second = owner.challenge("core-1")
    proof = owner.proof(first)
    assert owner.verify(first, proof)
    assert not owner.verify(second, proof)
    assert not owner.verify(first, None)
    assert not owner.verify(first, "0" * 64)
    other = OwnerSession()
    assert not other.verify(first, proof)
    with pytest.raises(OwnerAuthorityError, match="Untrusted core"):
        other.proof(first)
    secret = owner.bootstrap_line()[10:-1].decode()
    assert secret not in repr(owner)
    assert secret not in json.dumps(first)
    assert secret not in caplog.text
    owner.revoke()
    owner.revoke()
    assert not owner.verify(first, proof)
    with pytest.raises(OwnerAuthorityError, match="revoked"):
        owner.proof(second)


def test_private_bootstrap_consumes_only_first_record(monkeypatch):
    owner = OwnerSession()
    source = io.TextIOWrapper(io.BytesIO(owner.bootstrap_line() + b"SAM_STOP quit\n"))
    monkeypatch.setattr(sys, "stdin", source)
    child = read_owner_bootstrap()
    challenge = child.challenge("core-1")
    assert child.verify(challenge, owner.proof(challenge))
    assert source.readline() == "SAM_STOP quit\n"


@pytest.mark.parametrize("value", [b"", b"SAM_OWNER nope\n", b"SAM_STOP quit\n", b"x" * 200])
def test_bootstrap_rejects_invalid_records_without_echoing(value, monkeypatch):
    monkeypatch.setattr(sys, "stdin", io.TextIOWrapper(io.BytesIO(value)))
    with pytest.raises(OwnerAuthorityError, match="bootstrap unavailable"):
        read_owner_bootstrap()


@pytest.mark.parametrize("value", [{}, {"type": "control.application.quit"}, {"proof": "secret"}])
def test_signer_rejects_non_challenge_data(value):
    with pytest.raises(OwnerAuthorityError, match="Invalid owner"):
        OwnerSession().proof(value)


@pytest.mark.parametrize(
    "url",
    [
        "http://evil.test/",
        "http://127.0.0.1:8766.evil.test/",
        "http://x:y@127.0.0.1:8766/",
        "file:///tmp/ui.html",
        "http://127.0.0.1:1420/",
    ],
)
def test_owner_bootstrap_is_not_available_to_other_origins(url):
    assert not OwnerWindow._trusted_url(url, "http://127.0.0.1:8766")


def test_owner_assets_are_shipped_files_not_arbitrary_local_paths(tmp_path):
    assets = tmp_path / "static"
    (assets / "assets").mkdir(parents=True)
    (assets / "index.html").write_text("trusted", encoding="utf-8")
    script = assets / "assets" / "app.js"
    script.write_text("trusted", encoding="utf-8")
    window = OwnerWindow(tmp_path, OwnerSession(), asset_root=assets)
    origin = "http://127.0.0.1:8766"
    assert window._asset_path(origin + "/?shell=app", origin) == assets / "index.html"
    assert window._asset_path(origin + "/assets/app.js", origin) == script
    for value in [
        "/secret.txt",
        "/assets/../../secret",
        "/assets/%2e%2e/%2e%2e/secret",
        "/assets/%00",
    ]:
        assert window._asset_path(origin + value, origin) is None
    assert window._asset_path("https://evil.test/assets/app.js", origin) is None
