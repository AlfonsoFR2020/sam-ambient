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
document.documentElement.dataset.samVisualIdentity = "connected-skin-ivd-experimental";
document.documentElement.dataset.samUiSource = import.meta.env.SAM_UI_SOURCE_ID;
document.documentElement.dataset.samUiCommit = import.meta.env.SAM_UI_SOURCE_COMMIT;

createRoot(root).render(
  <StrictMode>
    <UiErrorBoundary>
      <App />
    </UiErrorBoundary>
  </StrictMode>,
);
