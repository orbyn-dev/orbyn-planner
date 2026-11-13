import "@fontsource-variable/geist/wght.css";
import "@fontsource/jetbrains-mono/400.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/app.css";
import { applyChoice, readStoredChoice, watchSystemTheme } from "./ui/theme";
import { applyTitlebar } from "./app/titlebar";
import { endBoot } from "./app/bootSplash";

applyChoice(readStoredChoice());
watchSystemTheme();
applyTitlebar();

const root = createRoot(document.getElementById("root")!);

async function start() {
  // The link in the account-deletion email opens a page of its own, before the app: no sign-in, no planner, no stores, and the
  // engine's module is never started. Nothing below is even loaded for it.
  if (window.location.pathname === "/cancel-deletion") {
    const { CancelDeletionPage } = await import("./features/account/CancelDeletionPage");
    root.render(
      <StrictMode>
        <CancelDeletionPage />
      </StrictMode>,
    );
    endBootAfterPaint();
    return;
  }
  // The Start over link opens a page of its own in the same way: it deletes an empty account, with no sign-in.
  if (window.location.pathname === "/delete-unused") {
    const { DeleteUnusedPage } = await import("./features/account/DeleteUnusedPage");
    root.render(
      <StrictMode>
        <DeleteUnusedPage />
      </StrictMode>,
    );
    endBootAfterPaint();
    return;
  }
  const { bootApp } = await import("./app/bootApp");
  bootApp(root);
}

/** These two pages are not the planner, so the account gate never runs and never ends the splash: they do it. */
function endBootAfterPaint(): void {
  requestAnimationFrame(() => requestAnimationFrame(endBoot));
}

void start();
