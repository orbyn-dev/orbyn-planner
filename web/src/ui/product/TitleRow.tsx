import { Icon } from "../primitives/Icon";

/**
 * The window's title row on the macOS desktop shell (Components `window-title-row`): after the traffic lights, a sidebar toggle,
 * then Back and Forward through the screens opened in this window. A dimmed arrow has nowhere to go and does nothing. The row has no
 * background and no title; the empty part of the sidebar's side of it drags the window (the strip along the top edge covers the rest).
 */
export function TitleRow({
  sideHidden,
  onToggle,
  canBack,
  canForward,
  onBack,
  onForward,
}: {
  sideHidden: boolean;
  onToggle: () => void;
  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
}) {
  return (
    <div className="titlerow" role="toolbar" aria-label="Window">
      <div className="tr-drag" data-tauri-drag-region aria-hidden="true" />
      <div className="tr-buttons">
        <button type="button" className="tbi" aria-label={sideHidden ? "Show sidebar" : "Hide sidebar"} aria-pressed={sideHidden} onClick={onToggle}>
          <Icon name="sidebar" />
        </button>
        <button type="button" className={canBack ? "tbi" : "tbi dim"} aria-label="Back" aria-disabled={!canBack} onClick={canBack ? onBack : undefined}>
          <Icon name="left" />
        </button>
        <button type="button" className={canForward ? "tbi" : "tbi dim"} aria-label="Forward" aria-disabled={!canForward} onClick={canForward ? onForward : undefined}>
          <Icon name="right" />
        </button>
      </div>
    </div>
  );
}
