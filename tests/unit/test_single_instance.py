from pathlib import Path

from sam_ambient.supervisor.single_instance import InstanceLock


def test_instance_lock_blocks_duplicate_and_stale_file_does_not_block(tmp_path: Path) -> None:
    path = tmp_path / ".sam/supervisor.lock"
    first = InstanceLock(path)
    second = InstanceLock(path)
    assert first.acquire()
    assert not second.acquire()
    first.release()
    assert second.acquire()
    second.release()
    assert path.is_file()


def test_instance_lock_release_is_idempotent(tmp_path: Path) -> None:
    lock = InstanceLock(tmp_path / "lock")
    assert lock.acquire()
    assert lock.acquire()
    lock.release()
    lock.release()


def test_duplicate_supervisor_exits_without_initializing_components(
    tmp_path: Path, monkeypatch
) -> None:
    import asyncio

    from sam_ambient.supervisor import cli

    class BusyLock:
        def __init__(self, _path: Path) -> None:
            pass

        def acquire(self) -> bool:
            return False

        def release(self) -> None:
            raise AssertionError("an unacquired lock must not be released")

    monkeypatch.setattr(cli, "InstanceLock", BusyLock)
    monkeypatch.setattr(
        cli,
        "SupervisorStore",
        lambda _path: (_ for _ in ()).throw(AssertionError("must not initialize state")),
    )
    args = cli.build_parser().parse_args(["--root", str(tmp_path), "--open-ui"])
    assert asyncio.run(cli.run(args)) == 0
