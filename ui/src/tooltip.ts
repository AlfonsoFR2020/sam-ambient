export interface TooltipRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface TooltipViewport {
  readonly width: number;
  readonly height: number;
}

export interface TooltipPlacement {
  readonly left: number;
  readonly top: number;
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly side: "above" | "below";
}

const EDGE_GAP = 12;
const ANCHOR_GAP = 6;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

export function placeTooltip(
  anchor: TooltipRect,
  tooltip: Pick<TooltipRect, "width" | "height">,
  viewport: TooltipViewport,
): TooltipPlacement {
  const maxWidth = Math.max(0, viewport.width - EDGE_GAP * 2);
  const maxHeight = Math.max(0, viewport.height - EDGE_GAP * 2);
  const width = Math.min(tooltip.width, maxWidth);
  const height = Math.min(tooltip.height, maxHeight);
  const left = clamp(
    anchor.left + (anchor.width - width) / 2,
    EDGE_GAP,
    viewport.width - EDGE_GAP - width,
  );
  const aboveTop = anchor.top - ANCHOR_GAP - height;
  const belowTop = anchor.bottom + ANCHOR_GAP;
  const side =
    aboveTop >= EDGE_GAP || belowTop + height > viewport.height - EDGE_GAP ? "above" : "below";

  return {
    left,
    top: clamp(
      side === "above" ? aboveTop : belowTop,
      EDGE_GAP,
      viewport.height - EDGE_GAP - height,
    ),
    maxWidth,
    maxHeight,
    side,
  };
}
