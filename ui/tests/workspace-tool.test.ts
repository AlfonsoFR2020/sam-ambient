import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WorkspacePanelHeader, WorkspaceToolButton } from "../src/components/WorkspaceTool";

it("keeps accessible action names, controlled expansion, explicit non-submit buttons and a labelled heading", () => {
  for (const tool of ["Console", "Memory"] as const) {
    const html = renderToStaticMarkup(
      createElement(WorkspaceToolButton, {
        tool,
        expanded: true,
        controls: "panel",
        buttonRef: createRef<HTMLButtonElement>(),
        onClick: () => {},
      }),
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="panel"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`<span>${tool}</span>`);
  }
  const header = renderToStaticMarkup(
    createElement(WorkspacePanelHeader, {
      title: "Sam Console",
      description: "Bounded owner actions",
      onClose: () => {},
    }),
  );
  expect(header).toContain("<h2>Sam Console</h2>");
  expect(header).toContain("Bounded owner actions");
  expect(header).toContain('type="button"');
});
