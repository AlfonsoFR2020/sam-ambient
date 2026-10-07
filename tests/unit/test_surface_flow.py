"""Owner control, durable migration and restart for the material-only setting."""

import asyncio

from sam_ambient.core.protocol import ControlCommand, ControlCommandType
from sam_ambient.core.storage import SQLiteSessionStore
from sam_ambient.runtime import RuntimeConfig, SamRuntime
from tests.unit.test_local_controls import RecordingProvider


def test_owner_surface_flow_persists_and_old_state_preserves_its_rate(tmp_path):
    async def scenario():
        db = tmp_path / "state.db"
        settings = dict(RuntimeConfig(tmp_path).visual_settings)
        settings.pop("surface_flow")
        settings["motion_intensity"] = 0.2
        SQLiteSessionStore(db).remember_visual_preferences(settings)
        runtime = SamRuntime(RecordingProvider("fixture"), RuntimeConfig(tmp_path, state_db=db))
        try:
            assert runtime._visual_settings["surface_flow"] == 0.2
            settings["surface_flow"] = 0.9
            result = await runtime.controls.dispatch(
                ControlCommand(
                    type=ControlCommandType.VISUAL_SETTINGS_SET,
                    command_id="flow",
                    monotonic_ms=1,
                    payload=settings,
                )
            )
            assert result.payload["visual_settings"]["surface_flow"] == 0.9
            assert runtime._visual_settings["motion_intensity"] == 0.2
        finally:
            await runtime.close()
        reopened = SamRuntime(RecordingProvider("fixture"), RuntimeConfig(tmp_path, state_db=db))
        try:
            assert reopened._visual_settings["surface_flow"] == 0.9
        finally:
            await reopened.close()

    asyncio.run(scenario())
