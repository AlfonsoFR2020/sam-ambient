import { useEffect, useId, useRef } from "react";

export function QuitDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const title = useId();
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      cancel.current?.focus();
    } else {
      dialog.current?.close();
    }
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="quit-confirmation"
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={title}>Quit Sam?</h2>
      <p>Stop Sam and cancel running work. This browser tab may remain open.</p>
      <button type="button" onClick={onConfirm}>
        Confirm quit
      </button>{" "}
      <button ref={cancel} type="button" onClick={onCancel}>
        Cancel
      </button>
    </dialog>
  );
}

export function ShutdownStatus({ stopped }: { stopped: boolean }) {
  return (
    <section className="shutdown-status" aria-label="Application shutdown" aria-live="polite">
      <h1>{stopped ? "Sam has stopped" : "Stopping Sam…"}</h1>
      <p>
        {stopped
          ? "Reconnection is off. You can safely close this tab. Launch Sam again to return."
          : "Waiting for shutdown acknowledgement. Running work is being cancelled."}
      </p>
    </section>
  );
}
