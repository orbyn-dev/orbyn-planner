// DEVELOPMENT ONLY: the page the match runner opens on the dev server. Production builds never include it (see fixture.ts).
import "@fontsource-variable/geist/wght.css";
import "@fontsource/jetbrains-mono/400.css";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/app.css";
import { THEMES, type Theme } from "../../src/ui/theme";
import { isScenario } from "./fixture";
import { installNoSocket } from "./noSocket";
import { mountMatch } from "./mount";
import { DeleteUnusedPage } from "../../src/features/account/DeleteUnusedPage";
import { applyChoice } from "../../src/ui/theme";
import { StrictMode } from "react";

installNoSocket();
const query = new URLSearchParams(window.location.search);
const scenario = query.get("scenario") ?? "";
const theme = (THEMES as readonly string[]).includes(query.get("theme") ?? "") ? (query.get("theme") as Theme) : "light";
if (query.get("page") === "delete-unused") {
  // The start-over link's page: a page of its own, with no planner and no account.
  applyChoice(theme);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <DeleteUnusedPage />
    </StrictMode>,
  );
} else {
  if (!isScenario(scenario)) throw new Error(`Unknown scenario "${scenario}"`);
  void mountMatch(createRoot(document.getElementById("root")!), { scenario, route: query.get("route") ?? "/today", theme, now: query.get("now") ?? undefined, account: query.get("account") === "out" ? "out" : query.get("account") === "fake" ? "fake" : query.get("account") !== "0", loading: query.get("loading") === "1" });
}
