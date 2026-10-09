import importlib.util
from pathlib import Path


def test_companion_includes_private_driver_and_license_inventory():
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location(
        "builder", root / "scripts/build_native_companion.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    resources = module.included_resources(root)
    driver = next(Path(source) for source, target in resources if target == "lib/playwright/driver")
    for name in (
        "node.exe",
        "LICENSE",
        "package/cli.js",
        "package/NOTICE",
        "package/ThirdPartyNotices.txt",
    ):
        assert (driver / name).is_file()
    for dependency in ("playwright", "pyee", "greenlet", "typing-extensions"):
        assert any(target.startswith(f"licenses/{dependency}-") for _, target in resources)
