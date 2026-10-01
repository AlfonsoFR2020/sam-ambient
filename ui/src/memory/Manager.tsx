import { useEffect, useState, useSyncExternalStore } from "react";
import { TERMINAL_ACTION_STATES } from "../agency/state";
import type { ProtocolClient } from "../state/client";
import { type MemoryRecord, memoryRecord, memoryRows } from "./model";

export function MemoryManager({
  client,
  connected,
}: {
  client: ProtocolClient;
  connected: boolean;
}) {
  const actions = useSyncExternalStore(client.subscribe, client.getAgencySnapshot);
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [request, setRequest] = useState<string>();
  const [query, setQuery] = useState("");
  const [review, setReview] = useState("all");
  const [scope, setScope] = useState("personal");
  const [kind, setKind] = useState("preference");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState<MemoryRecord>();
  const [deleting, setDeleting] = useState<string>();
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [message, setMessage] = useState("");

  const run = async (operation: string, args: Record<string, unknown>) => {
    setMessage("");
    setRequest("admitting");
    const id = await client.executeCapability(`memory.${operation}`, args);
    if (id) setRequest(id);
    else setMessage("Other actions are active; try again when one finishes.");
  };
  const list = (page = 0) => {
    setOffset(page);
    return run("list", { query, scope: "all", review, offset: page });
  };

  useEffect(() => {
    if (!connected) {
      setRecords([]);
      setEditing(undefined);
      setContent("");
      setRequest(undefined);
      return;
    }
    if (!open) return;
    const action = actions.find((item) => item.id === request);
    if (!action || !TERMINAL_ACTION_STATES.has(action.state)) return;
    setRequest(undefined);
    if (action.state !== "completed" || action.truncated) {
      setMessage(action.output ?? "Memory action did not complete; refresh before retrying.");
      return;
    }
    if (action.capability === "memory.list") {
      setRecords(memoryRows(action.result?.records));
      setHasMore(action.result?.has_more === true);
    } else if (action.capability === "memory.get") {
      const record = memoryRecord(action.result?.record);
      if (record) {
        setEditing(record);
        setContent(record.content);
      }
    } else {
      setEditing(undefined);
      setContent("");
      setDeleting(undefined);
      setMessage(action.capability === "memory.delete" ? "Memory deleted." : "Memory saved.");
      // Refresh via a new owner action; result text never dispatches anything.
      void client
        .executeCapability("memory.list", { query, scope: "all", review, offset })
        .then(setRequest);
    }
  }, [actions, request, connected, client, query, review, offset, open]);

  return (
    <>
      <button
        type="button"
        className="memory-reveal"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && connected) void list();
          if (!next) {
            setRecords([]);
            setContent("");
            setEditing(undefined);
          }
        }}
      >
        Memory
      </button>
      {open && (
        <section className="memory-manager" aria-label="Sam Memory">
          <header>
            <strong>Sam Memory</strong>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setRecords([]);
                setEditing(undefined);
                setContent("");
              }}
            >
              Close
            </button>
          </header>
          <p>
            Selected local context, not chat history. Proposed claims require review; credentials do
            not belong here.
          </p>
          {!connected && <output>Connect through Sam's owner window to manage memory.</output>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void list();
            }}
          >
            <label>
              Search memory{" "}
              <input
                value={query}
                maxLength={256}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </label>
            <label>
              Review state{" "}
              <select value={review} onChange={(event) => setReview(event.currentTarget.value)}>
                <option value="all">All</option>
                <option value="reviewed">Reviewed</option>
                <option value="proposed">Proposed</option>
              </select>
            </label>
            <button type="submit" disabled={!connected || !!request}>
              Search / refresh
            </button>
          </form>
          {message && <output aria-live="polite">{message}</output>}
          <section className="memory-manager__records" aria-label="Memory entries">
            {records.map((row) => (
              <article key={row.id}>
                <strong>{row.kind}</strong> <span>{row.review}</span>
                <p>
                  {row.content}
                  {row.preview && "…"}
                </p>
                <small>
                  Source: {row.source_kind} · {row.source_ref} · revision {row.revision} ·{" "}
                  {row.scope.startsWith("workspace:") ? "workspace" : row.scope}
                </small>
                <div className="memory-manager__actions">
                  <button
                    type="button"
                    disabled={!connected || !!request}
                    onClick={() => void run("get", { id: row.id })}
                  >
                    Inspect / correct
                  </button>
                  {row.review === "proposed" && (
                    <button
                      type="button"
                      disabled={!connected || !!request}
                      onClick={() => void run("approve", { id: row.id, revision: row.revision })}
                    >
                      Approve claim
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!connected || !!request}
                    onClick={() => setDeleting(row.id)}
                  >
                    Delete
                  </button>
                  {deleting === row.id && (
                    <button
                      type="button"
                      disabled={!connected || !!request}
                      onClick={() => void run("delete", { id: row.id, revision: row.revision })}
                    >
                      Confirm permanent delete
                    </button>
                  )}
                </div>
              </article>
            ))}
            {records.length === 0 && <p>No memories on this page.</p>}
          </section>
          <div>
            <button
              type="button"
              disabled={offset === 0 || !!request || !connected}
              onClick={() => void list(Math.max(0, offset - 8))}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!hasMore || !!request || !connected}
              onClick={() => void list(offset + 8)}
            >
              Next
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                editing ? "correct" : "create",
                editing
                  ? { id: editing.id, revision: editing.revision, content }
                  : { content, kind, scope },
              );
            }}
          >
            <label>
              {editing ? "Correct memory" : "New memory"}
              <textarea
                value={content}
                maxLength={1200}
                onChange={(event) => setContent(event.currentTarget.value)}
              />
            </label>
            {!editing && (
              <>
                <label>
                  Memory kind{" "}
                  <select value={kind} onChange={(event) => setKind(event.currentTarget.value)}>
                    <option value="preference">Preference</option>
                    <option value="fact">Fact</option>
                    <option value="project">Project context</option>
                  </select>
                </label>
                <label>
                  Memory scope{" "}
                  <select value={scope} onChange={(event) => setScope(event.currentTarget.value)}>
                    <option value="personal">Personal</option>
                    <option value="workspace">This workspace</option>
                  </select>
                </label>
              </>
            )}
            <button type="submit" disabled={!connected || !!request || !content.trim()}>
              {editing ? "Save correction" : "Remember explicitly"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(undefined);
                  setContent("");
                }}
              >
                Cancel edit
              </button>
            )}
          </form>
        </section>
      )}
    </>
  );
}
