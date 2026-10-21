import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { UiErrorBoundary } from "./UiErrorBoundary";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Sam UI root element is missing");
// Inspectable provenance, with no application authority or private data.
document.documentElement.dataset.samUiBuild = import.meta.env.DEV
  ? "development-source"
  : "built-assets";
document.documentElement.dataset.samVisualIdentity = "connected-skin-ivc-experimental";

createRoot(root).render(
  <StrictMode>
    <UiErrorBoundary>
      <App />
    </UiErrorBoundary>
  </StrictMode>,
);
