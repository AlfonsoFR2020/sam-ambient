import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error?: Error;
}

/** Keeps a failed React render recoverable even if the main UI cannot mount. */
export class UiErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[Sam UI] Unhandled interface error", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="ui-error" role="alert">
        <h1>Sam’s interface hit a problem</h1>
        <p>
          Reload the interface to reconnect. The Sam core and committed conversation are separate.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload interface
        </button>
        <details>
          <summary>Technical details</summary>
          <pre>{this.state.error.message}</pre>
        </details>
      </main>
    );
  }
}
