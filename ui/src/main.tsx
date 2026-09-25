import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { UiErrorBoundary } from "./UiErrorBoundary";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Sam UI root element is missing");

createRoot(root).render(
  <StrictMode>
    <UiErrorBoundary>
      <App />
    </UiErrorBoundary>
  </StrictMode>,
);
