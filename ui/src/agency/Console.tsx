import { useState, useSyncExternalStore } from "react";
import type { ProtocolClient } from "../state/client";
import { TERMINAL_ACTION_STATES } from "./state";

export function AgencyConsole({
  client,
  connected,
}: {
  client: ProtocolClient;
  connected: boolean;
}) {
  const actions = useSyncExternalStore(client.subscribe, client.getAgencySnapshot);
  const [open, setOpen] = useState(false);
  const [capability, setCapability] = useState("files.list");
  const [path, setPath] = useState(".");
  return (
    <>
      <button
        type="button"
        className="agency-reveal"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Console
      </button>
      {open && (
        <section className="agency-console" aria-label="Sam Console">
          <header>
            <strong>Sam Console</strong>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </header>
          <p>Owner actions · read-only workspace · returned data is untrusted</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void client.executeCapability(
                capability,
                capability === "system.info"
                  ? {}
                  : {
                      root: "workspace",
                      path,
                      ...(capability === "files.read"
                        ? { max_bytes: 8_192, max_lines: 200 }
                        : { max_entries: 100, depth: 0 }),
                    },
              );
            }}
          >
            <label>
              Action{" "}
              <select value={capability} onChange={(event) => setCapability(event.target.value)}>
                <option value="files.list">List directory</option>
                <option value="files.read">Read text file</option>
                <option value="system.info">System information</option>
              </select>
            </label>
            {capability !== "system.info" && (
              <label>
                Workspace path{" "}
                <input
                  value={path}
                  maxLength={4096}
                  onChange={(event) => setPath(event.target.value)}
                />
              </label>
            )}
            <button type="submit" disabled={!connected}>
              Run action
            </button>
          </form>
          <section className="agency-console__output" aria-label="Console results">
            {actions.map((action) => (
              <article key={action.id}>
                <strong>{action.capability}</strong> <span>{action.state}</span>
                <small>{action.id}</small>
                {!TERMINAL_ACTION_STATES.has(action.state) && (
                  <button
                    type="button"
                    onClick={() => {
                      void client.cancelCapability(action.id);
                    }}
                  >
                    Cancel action
                  </button>
                )}
                {action.output && <pre>{action.output}</pre>}
                {action.truncated && <small>Result truncated</small>}
              </article>
            ))}
          </section>
        </section>
      )}
    </>
  );
}
