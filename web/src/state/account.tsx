import { askWhetherDeleted } from "../data/account/deletedAccount";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { StoredSession } from "../data/account/keyStore";
import { setSessionToken } from "../data/account/session";
import { closePlanner, removeAccountPlanner } from "../data/local/planners";
import { signOut as signOutFlow } from "./services/flows";
import { holdMemoryOnly } from "../lib/browserStorage";
import { forgetProtectionNotice } from "./protectionNotice";
import type { AuthServices } from "./services/auth";
import { cryptoLoad } from "./crypto";

export type AuthStatus =
  /** Reading the saved session. */
  | "loading"
  /** Signed out and has not chosen to go on without an account: the public landing page. */
  | "landing"
  /** The planner on this device only. Signing in is optional. */
  | "local"
  /** Signed in, but this device waits for a trusted one to approve it. */
  | "pending"
  | "signedIn";

export type AuthScreen = "landing" | "signup" | "signin" | "cant";

interface AuthApiValue {
  services: AuthServices;
  status: AuthStatus;
  session: StoredSession | null;
  /** The sign-in screens open over the planner (from Settings), or null. */
  overlay: AuthScreen | null;
  openAuth: (screen?: AuthScreen) => void;
  closeAuth: () => void;
  /** "Use without an account": everything stays on this device. */
  useWithoutAccount: () => void;
  /** `removePlanner`: also delete this account's planner from this browser (otherwise it stays, and opens only when this account signs in again). */
  signOut: (options?: { removePlanner?: boolean; keepDevice?: boolean }) => Promise<void>;
  /** Something that went wrong while signing out, to show. */
  problem: string | null;
  bootstrapProblem: string | null;
  retryBootstrap: () => void;
  /** The account's keys and session are held in this tab's memory only, because this browser would not store them. */
  keysInMemory: boolean;
  /** The person went on with the keys held in this tab only: the planner opens, and they sign in again next time. */
  memoryAccepted: boolean;
  acceptMemoryOnly: () => void;
}

const LOCAL_ONLY_KEY = "orbyn-planner.local-only";
const AuthContext = createContext<AuthApiValue | null>(null);

function readLocalOnly(): boolean {
  try {
    return localStorage.getItem(LOCAL_ONLY_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Holds who is signed in. Without `services` there are no accounts (tests of the planner alone),
 * and the planner always runs on this device.
 */
export function AuthProvider({ services, children }: { services: AuthServices | null; children: ReactNode }) {
  const [loadedServices, setLoadedServices] = useState<AuthServices | null>(null);
  const loaded = services === null || loadedServices === services;
  const [localOnly, setLocalOnly] = useState(readLocalOnly);
  const [overlay, setOverlay] = useState<AuthScreen | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<{ services: AuthServices; message: string } | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const bootstrapProblem = bootstrapError?.services === services ? bootstrapError.message : null;
  const retryBootstrap = useCallback(() => { setBootstrapError(null); setBootstrapAttempt((attempt) => attempt + 1); }, []);
  const [accepted, setAccepted] = useState(false);
  const none = useMemo(() => ({ subscribe: () => () => undefined, get: () => null as StoredSession | null }), []);
  const session = useSyncExternalStore(services ? services.tokens.subscribe : none.subscribe, services ? services.tokens.getSession : none.get);
  const noMemory = useMemo(() => ({ subscribe: () => () => undefined, get: () => false }), []);
  const keysInMemory = useSyncExternalStore(services ? services.keys.subscribe : noMemory.subscribe, services ? () => services.keys.inMemory : noMemory.get);

  useEffect(() => {
    if (!services) return;
    let live = true;
    let finished = false;
    let stopRetry: () => void = () => undefined;
    let stopSession: () => void = () => undefined;
    const finish = async () => {
      if (!live || finished) return;
      finished = true;
      stopRetry();
      stopSession();
      // A sign-out while crypto is loading owns the new identity too.
      if (!services.tokens.getSession()) {
        const identity = await services.keys.loadIdentity().catch(() => null);
        if (live && identity?.email) void askWhetherDeleted(services.api, { accountId: identity.accountId, email: identity.email }, services.keys.inMemory);
      }
      if (live) setLoadedServices(services);
    };
    void services.ready
      .then(() => live ? services.tokens.load(services.now()) : undefined)
      .then(async () => {
        if (!live) return;
        if (services.tokens.getSession()) {
          stopSession = services.tokens.subscribe(() => {
            if (!services.tokens.getSession()) void finish();
          });
          try {
            await services.ensureCrypto();
          } catch {
            if (!live || finished) return;
            // Keep the saved account blocked; the existing CryptoProblem retries the shared module loader.
            stopRetry = cryptoLoad.subscribe(() => {
              if (cryptoLoad.get() === "ready") void finish();
            });
            return;
          }
        }
        await finish();
      }).catch((error: unknown) => {
        if (live) setBootstrapError({ services, message: error instanceof Error ? error.message : "Couldn’t open this device’s storage." });
      });
    return () => {
      live = false;
      stopRetry();
      stopSession();
    };
  }, [services, bootstrapAttempt]);

  // While the keys are held in this tab's memory only, nothing the account screens remember reaches storage either.
  useEffect(() => (keysInMemory ? holdMemoryOnly() : undefined), [keysInMemory]);

  // Another tab signed out: this one drops its session too.
  useEffect(() => {
    if (!services) return;
    return services.signedOut.listen(() => void services.tokens.clear());
  }, [services]);

  // Engine requests made outside the auth screens (calendar feeds) read the token from here. Only a
  // trusted device's session is passed on: the engine refuses the rest.
  const engineToken = loaded && session?.deviceState === "trusted" ? session.token : null;
  useEffect(() => {
    setSessionToken(engineToken);
    return () => setSessionToken(null);
  }, [engineToken]);

  const status: AuthStatus = !services
    ? "local"
    : !loaded
      ? "loading"
      : session
        ? session.deviceState === "pending"
          ? "pending"
          : "signedIn"
        : localOnly
          ? "local"
          : "landing";

  const useWithoutAccount = useCallback(() => {
    try {
      localStorage.setItem(LOCAL_ONLY_KEY, "1");
    } catch {
      // Not remembered across visits, but fine for this one.
    }
    setLocalOnly(true);
    setOverlay(null);
  }, []);

  const value = useMemo<AuthApiValue | null>(() => {
    if (!services) return null;
    return {
      services,
      status,
      session,
      overlay,
      openAuth: (screen = "signin") => setOverlay(screen),
      closeAuth: () => setOverlay(null),
      useWithoutAccount,
      problem,
      bootstrapProblem,
      retryBootstrap,
      keysInMemory,
      memoryAccepted: accepted && keysInMemory,
      acceptMemoryOnly: () => setAccepted(true),
      signOut: async (options) => {
        setProblem(null);
        const accountId = session?.accountId;
        try {
          await signOutFlow(services, { keepDevice: options?.keepDevice });
        } catch (e) {
          setProblem(e instanceof Error ? e.message : "Signing out didn’t finish.");
        }
        if (accountId) forgetProtectionNotice(accountId);
        // The app is on the device-only planner now. This account's stays on disk or goes, as the person chose.
        if (accountId) {
          if (options?.removePlanner) await removeAccountPlanner(accountId).catch(() => setProblem("Signed out, but this account’s planner couldn’t be removed from this browser."));
          else closePlanner(accountId);
        }
        setOverlay(null);
      },
    };
  }, [services, status, session, overlay, problem, bootstrapProblem, retryBootstrap, keysInMemory, accepted, useWithoutAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** The account state, or null when this build runs without accounts. */
export function useAuth(): AuthApiValue | null {
  return useContext(AuthContext);
}
