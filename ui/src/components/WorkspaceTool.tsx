import type { Ref } from "react";

/** Presentation only: actions and owner capability mediation stay with the caller. */
export function WorkspaceToolButton({
  tool,
  expanded,
  controls,
  buttonRef,
  onClick,
}: {
  tool: "Console" | "Memory";
  expanded: boolean;
  controls: string;
  buttonRef: Ref<HTMLButtonElement>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`workspace-tool ${tool === "Console" ? "agency-reveal" : "memory-reveal"}`}
      ref={buttonRef}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      title={
        tool === "Console"
          ? "Console · run bounded owner actions and inspect their results"
          : "Memory · review and manage Sam’s saved local records"
      }
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        aria-hidden="true"
        focusable="false"
      >
        {tool === "Console" ? (
          <path d="m4 5 5 5-5 5m7 0h5" />
        ) : (
          <path d="M10 4C7 2 3 3 3 6v10c3-2 5-2 7 0 2-2 4-2 7 0V6c0-3-4-4-7-2Zm0 0v12" />
        )}
      </svg>
      <span>{tool}</span>
    </button>
  );
}

export function WorkspacePanelHeader({
  title,
  description,
  onClose,
}: {
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <header className="workspace-panel__header">
      <div>
        <small className="workspace-panel__eyebrow">{description}</small>
        <h2>{title}</h2>
      </div>
      <button type="button" className="workspace-panel__close" onClick={onClose}>
        Close
      </button>
    </header>
  );
}
