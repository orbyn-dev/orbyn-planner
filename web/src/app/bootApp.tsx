import { StrictMode } from "react";
import type { Root } from "react-dom/client";

import { App } from "./App";
import { cryptoLoad, ensureRealAuthCrypto } from "../state/crypto";
import { SignInUnavailable } from "../core/account/authCrypto";
import { createAuthServices } from "../state/services/auth";

/** Starts the planner with accounts. Loaded only for the planner's own pages, never for the page behind the deletion email's link. */
export function bootApp(root: Root): void {
  // Saved accounts and account-entry flows request crypto; a confirmed signed-out launch never imports it.
  const auth = createAuthServices({ ensureCrypto: async () => {
    await ensureRealAuthCrypto();
    if (cryptoLoad.get() === "failed") throw new SignInUnavailable();
  } });
  root.render(
    <StrictMode>
      <App auth={auth} />
    </StrictMode>,
  );
}
