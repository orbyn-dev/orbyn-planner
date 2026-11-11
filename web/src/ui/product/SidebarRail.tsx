import { useRef, useState } from "react";
import { clampSidebar, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, SIDEBAR_STEP } from "./sidebarWidth";

/** The width pill on the rail while dragging (Components `Sidebar resize rail`): the width, and which limit it stopped at. */
function pillText(width: number): string {
  if (width <= SIDEBAR_MIN) return `${width} · minimum`;
  if (width >= SIDEBAR_MAX) return `${width} · maximum`;
  return String(width);
}

/**
 * The sidebar's resize rail, working as it does in Engineering: drag the sidebar's right edge (it resizes live through the
 * `--side-w` variable on the app and the width is saved when the drag ends), double-click for the default width, Left and Right
 * move it 16 px when the rail has focus.
 */
export function SidebarRail({ width, onChange }: { width: number; onChange: (width: number) => void }) {
  const [dragging, setDragging] = useState(false);
  const [live, setLive] = useState(width);
  const latest = useRef(width);
  const preview = (next: number) => document.querySelector<HTMLElement>(".app")?.style.setProperty("--side-w", `${next}px`);
  return (
    <div
      className="side-rail"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      tabIndex={0}
      data-dragging={dragging || undefined}
      title="Drag to resize"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        latest.current = width;
        setLive(width);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!dragging) return;
        latest.current = clampSidebar(event.clientX);
        setLive(latest.current);
        preview(latest.current);
      }}
      onLostPointerCapture={() => {
        setDragging(false);
        onChange(latest.current);
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        onChange(width + (event.key === "ArrowRight" ? SIDEBAR_STEP : -SIDEBAR_STEP));
      }}
      onDoubleClick={() => onChange(SIDEBAR_DEFAULT)}
    >
      {dragging && <span className="side-pill">{pillText(live)}</span>}
    </div>
  );
}
