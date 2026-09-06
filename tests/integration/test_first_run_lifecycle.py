import asyncio
import json
import socket as sockets
import sys
from pathlib import Path

import pytest
from websockets.asyncio.client import connect

from sam_ambient.adapters.ui.websocket import SAM_PROTOCOL_SUBPROTOCOL
from sam_ambient.core.protocol import ControlCommand, ControlCommandType
from sam_ambient.supervisor import (
    ComponentSpec,
    SubprocessLauncher,
    Supervisor,
    SupervisorStore,
    UpdatableComponent,
    VersionLayout,
)


@pytest.mark.parametrize("packaged", [False, True, "staged"])
def test_real_core_quit_stops_supervisor_without_restart(tmp_path, packaged):
    fixture = Path(__file__).resolve().parents[1] / "fixtures/first_run_core.py"
    if packaged == "staged":
        component_root = tmp_path / "components/sam-core"
        version = component_root / "versions/test"
        version.mkdir(parents=True)
        (version / "component.json").write_text(
            json.dumps({"component_id": "sam-core", "version": "test"}), encoding="utf-8"
        )
        (version / "entry_helper.py").write_text(
            "from sam_ambient.cli import main\n", encoding="utf-8"
        )
        (version / "sam_core.py").write_text(
            "import sys\nfrom entry_helper import main\n"
            "raise SystemExit(main(['runtime', *sys.argv[1:]]))\n",
            encoding="utf-8",
        )
        layout = VersionLayout(UpdatableComponent("sam-core", component_root, tmp_path))
        layout.activate(layout.artifact("test"))

    async def scenario():
        ready = asyncio.Event()
        shutdown_task = None

        def quit_app():
            nonlocal shutdown_task
            if shutdown_task is None:
                shutdown_task = asyncio.create_task(supervisor.shutdown())

        with sockets.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            port = reservation.getsockname()[1]
        component = ComponentSpec(
            "sam-core",
            (sys.executable, str(fixture), "--root", str(tmp_path), "--port", str(port)),
            tmp_path,
        )
        if packaged:
            component = ComponentSpec(
                "sam-core",
                (
                    sys.executable,
                    "-m",
                    "sam_ambient.supervisor.component_launcher",
                    "--component-root",
                    str(tmp_path / "components/sam-core"),
                    "--",
                    "--root",
                    str(tmp_path),
                    "--port",
                    str(port),
                    "--no-voice",
                    "--no-tts",
                    "--provider",
                    "ollama",
                    "--base-url",
                    "http://127.0.0.1:1",
                ),
                tmp_path,
            )
        store = SupervisorStore(tmp_path / "state.db")
        supervisor = Supervisor(
            (component,),
            SubprocessLauncher(request_shutdown=quit_app),
            store,
            on_ready=lambda _id: ready.set(),
        )
        try:
            await supervisor.start()
            async with asyncio.timeout(15):
                await ready.wait()
                async with connect(
                    f"ws://127.0.0.1:{port}",
                    origin="http://127.0.0.1:8766",
                    subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
                ) as socket:
                    event = json.loads(await socket.recv())
                    await socket.send(
                        ControlCommand(
                            type=ControlCommandType.APPLICATION_QUIT,
                            command_id="quit-smoke",
                            monotonic_ms=1,
                            session_id=event["session_id"],
                        ).to_json()
                    )
                    while True:
                        event = json.loads(await socket.recv())
                        if event["type"] == "system.stopping":
                            break
                await supervisor.wait_component("sam-core")
                if shutdown_task:
                    await shutdown_task
            status = supervisor.statuses["sam-core"]
            assert status.health == "STOPPED" and status.restart_count == 0
            assert not store.crashes()
        finally:
            await supervisor.shutdown()

    asyncio.run(scenario())
