import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

export function coreSimulatorEvents() {
  const root = resolve(process.cwd(), "..");
  const environment = { ...process.env };
  delete environment.SSLKEYLOGFILE;
  return JSON.parse(
    execFileSync(
      resolve(root, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python"),
      ["-m", "tests.integration.test_core_experience"],
      { cwd: root, env: environment, timeout: 30_000, maxBuffer: 1024 * 1024 },
    ).toString(),
  );
}
