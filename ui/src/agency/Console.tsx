import { useId, useRef, useState, useSyncExternalStore } from "react";
import type { ProtocolClient } from "../state/client";
import { TERMINAL_ACTION_STATES } from "./state";

export const consoleArguments = (capability: string, path: string): Record<string, unknown> =>
  ["system.info", "browser.read", "browser.close"].includes(capability)
    ? {}
    : capability === "browser.navigate"
      ? { url: path }
      : {
          root: "workspace",
          path,
          ...(capability === "files.read"
            ? { max_bytes: 8_192, max_lines: 200 }
            : { max_entries: 100, depth: 0 }),
        };

export function AgencyConsole({
  client,
  connected,
  open: controlledOpen,
  onOpenChange,
}: {
  client: ProtocolClient;
  connected: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const actions = useSyncExternalStore(
    client.subscribe,
    client.getAgencySnapshot,
    client.getAgencySnapshot,
  );
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const panelId = useId();
  const reveal = useRef<HTMLButtonElement>(null);
  const [capability, setCapability] = useState("files.list");
  const [path, setPath] = useState(".");
  const activeCount = actions.filter((action) => !TERMINAL_ACTION_STATES.has(action.state)).length;
  return (
    <>
      <button
        type="button"
        className="agency-reveal"
        ref={reveal}
        title="Console · run bounded owner actions and inspect their results"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        Console
      </button>
      {open && (
        <section id={panelId} className="agency-console" aria-label="Sam Console">
          <header>
            <strong>Sam Console</strong>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reveal.current?.focus();
              }}
            >
              Close
            </button>
          </header>
          <p>Inspect workspace files, system information and public pages. Results appear below.</p>
          {!connected && <output>Connect through Sam's owner window to run actions.</output>}
          {activeCount >= 4 && (
            <output>Four actions are active. Finish or cancel one to continue.</output>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!connected || activeCount >= 4) return;
              void client.executeCapability(capability, consoleArguments(capability, path));
            }}
          >
            <label>
              Action{" "}
              <select value={capability} onChange={(event) => setCapability(event.target.value)}>
                <option value="files.list">List directory</option>
                <option value="files.read">Read text file</option>
                <option value="system.info">System information</option>
                <option value="browser.navigate">Open public HTTPS page</option>
                <option value="browser.read">Read current browser page</option>
                <option value="browser.close">Close owned browser</option>
              </select>
            </label>
            {!["system.info", "browser.read", "browser.close"].includes(capability) && (
              <label>
                {capability === "browser.navigate" ? "Public HTTPS URL" : "Workspace path"}{" "}
                <input
                  value={path}
                  maxLength={capability === "browser.navigate" ? 2048 : 4096}
                  onChange={(event) => setPath(event.target.value)}
                />
              </label>
            )}
            <button type="submit" disabled={!connected || activeCount >= 4}>
              Run action
            </button>
          </form>
          <section className="agency-console__output" aria-label="Console results">
            {actions
              .filter((action) => !action.capability.startsWith("memory."))
              .map((action) => (
                <article key={action.id}>
                  <strong>{action.capability}</strong> <span>{action.state}</span>
                  <small>{action.id}</small>
                  {!TERMINAL_ACTION_STATES.has(action.state) && (
                    <button
                      type="button"
                      disabled={!connected}
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
