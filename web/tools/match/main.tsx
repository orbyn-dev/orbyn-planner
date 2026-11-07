// DEVELOPMENT ONLY: the page the match runner opens on the dev server. Production builds never include it (see fixture.ts).
import "@fontsource-variable/geist/wght.css";
import "@fontsource/jetbrains-mono/400.css";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/app.css";
import { THEMES, type Theme } from "../../src/app/theme";
import { isScenario } from "./fixture";
import { mountMatch } from "./mount";

const query = new URLSearchParams(window.location.search);
const scenario = query.get("scenario") ?? "";
const theme = (THEMES as readonly string[]).includes(query.get("theme") ?? "") ? (query.get("theme") as Theme) : "light";
if (!isScenario(scenario)) throw new Error(`Unknown scenario "${scenario}"`);
void mountMatch(createRoot(document.getElementById("root")!), { scenario, route: query.get("route") ?? "/today", theme });
