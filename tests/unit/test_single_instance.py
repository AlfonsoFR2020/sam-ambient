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
