"""Offline Windows Voice Capture DMO filter probe; never opens audio devices.

Compile scripts/native/windows_aec_probe.cpp with installed MSVC/Windows SDK,
then python -m scripts.windows_aec_prototype --dll .sam/windows-aec/sam_windows_aec.dll
Reuses the unchanged extracted-AEC acceptance fixtures, not that processor.
"""

import argparse
import ctypes
import json
import threading
from pathlib import Path

from scripts.aec_prototype import FRAME_BYTES, evaluate


class WindowsAec:
    def __init__(self, dll: Path, suppression=0):
        if isinstance(suppression, bool) or suppression not in (0, 1, 2):
            raise ValueError("residual suppression must be 0, 1 or 2")
        self.suppression = suppression
        self.thread = threading.get_ident()
        self.library = ctypes.WinDLL(str(dll.resolve()))
        self.library.sam_aec_create.argtypes = [
            ctypes.c_int32,
            ctypes.POINTER(ctypes.c_void_p),
            ctypes.POINTER(ctypes.c_uint32),
        ]
        self.library.sam_aec_create.restype = ctypes.c_int32
        self.library.sam_aec_close.argtypes = [ctypes.c_void_p]
        self.library.sam_aec_close.restype = None
        self.library.sam_aec_process.argtypes = [
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.c_uint32,
            ctypes.POINTER(ctypes.c_uint32),
            ctypes.POINTER(ctypes.c_uint32),
        ]
        self.library.sam_aec_process.restype = ctypes.c_int32
        self.handle = ctypes.c_void_p()
        self.pending = bytearray()
        self.reset()

    def check_thread(self):
        if threading.get_ident() != self.thread:
            raise RuntimeError("COM processor requires one serialized thread owner")

    @staticmethod
    def check(result, stage):
        if result < 0:
            raise RuntimeError(
                f"Windows AEC stage={stage.value} HRESULT=0x{result & 0xFFFFFFFF:08x}"
            )

    def process(self, capture: bytes, render: bytes, *, delay_ms: int) -> bytes:
        self.check_thread()
        if len(capture) != FRAME_BYTES or len(render) != FRAME_BYTES:
            raise ValueError("exact 10 ms mono PCM16 frames required")
        if isinstance(delay_ms, bool) or not isinstance(delay_ms, int) or not 0 <= delay_ms <= 250:
            raise ValueError("unsupported fixture delay")
        # DMO owns echo-path estimation. These timestamps describe paired current
        # capture/render frames; the fixture delay is not a DMO delay-hint API.
        if not self.handle.value:
            raise RuntimeError("processor closed")
        output = ctypes.create_string_buffer(FRAME_BYTES * 16)
        length, stage = ctypes.c_uint32(), ctypes.c_uint32()
        self.check(
            self.library.sam_aec_process(
                self.handle,
                capture,
                render,
                output,
                len(output),
                ctypes.byref(length),
                ctypes.byref(stage),
            ),
            stage,
        )
        self.pending.extend(output.raw[: length.value])
        if len(self.pending) > FRAME_BYTES * 16:
            raise RuntimeError("processor output exceeded bounded queue")
        if len(self.pending) < FRAME_BYTES:
            return bytes(FRAME_BYTES)
        result = bytes(self.pending[:FRAME_BYTES])
        del self.pending[:FRAME_BYTES]
        return result

    def reset(self):
        self.close()
        stage = ctypes.c_uint32()
        self.check(
            self.library.sam_aec_create(
                self.suppression, ctypes.byref(self.handle), ctypes.byref(stage)
            ),
            stage,
        )
        self.pending.clear()

    def close(self):
        self.check_thread()
        if self.handle.value:
            self.library.sam_aec_close(self.handle)
            self.handle = ctypes.c_void_p()
        self.pending.clear()

    def __del__(self):
        if (
            getattr(self, "handle", None)
            and self.handle.value
            and threading.get_ident() == self.thread
        ):
            self.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dll", type=Path, required=True)
    parser.add_argument("--aes", type=int, choices=(0, 1, 2), default=0)
    args = parser.parse_args()
    try:
        report = evaluate(lambda: WindowsAec(args.dll, args.aes))
    except (RuntimeError, OSError) as error:
        report = {"separation_pass": False, "integration_error": str(error)}
    report["residual_suppression"] = args.aes
    Path(f".sam/windows-aec-result-{args.aes}.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["separation_pass"] else 1)
