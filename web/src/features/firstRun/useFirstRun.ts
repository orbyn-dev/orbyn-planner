import { useEffect, useState } from "react";
import { useAuth } from "../../state/account";
import { browserStorage } from "../../lib/browserStorage";
import { usePlanner } from "../../state/store";

/**
 * Whether first run has been done, kept on this device only (never on a server): per account when signed in, otherwise for the
 * local-only planner of this browser.
 */
export const firstRunKey = (accountId: string | null) => `orbyn-planner.first-run.${accountId ?? "local"}`;

export function isFirstRunDone(accountId: string | null): boolean {
  try {
    return browserStorage.get(firstRunKey(accountId)) === "done";
  } catch {
    return false;
  }
}

export function markFirstRunDone(accountId: string | null): void {
  try {
    browserStorage.set(firstRunKey(accountId), "done");
  } catch {
    // Not remembered: first run would show again next time, so it is only offered while the planner is still empty.
  }
}

/**
 * First run shows on a first launch only: a new account, or the first time this browser opens the planner without one. A planner that
 * already holds anything of the person's (an existing user after this was added) is marked done without being shown, so an empty
 * planner later never brings it back.
 */
export function useFirstRun(): { active: boolean; finish: () => void } {
  const auth = useAuth();
  const accountId = auth?.session?.accountId ?? null;
  const { tasks, events, lists, calendars, ready } = usePlanner();
  const [done, setDone] = useState(() => isFirstRunDone(accountId));
  /** Decided once, when the planner has loaded: what first run itself adds (a calendar, a list) must not end it half way through. */
  const [show, setShow] = useState<boolean | null>(null);
  const untouched = tasks.length === 0 && events.length === 0 && lists.length <= 1 && calendars.length <= 1;
  useEffect(() => {
    if (!ready || show !== null) return;
    // In a timer, not at once: the decision is made after the planner has drawn, and never again.
    const timer = setTimeout(() => {
      if (!done && !untouched) markFirstRunDone(accountId);
      setShow(!done && untouched);
    }, 0);
    return () => clearTimeout(timer);
  }, [ready, show, done, untouched, accountId]);
  return {
    active: show === true && !done,
    finish: () => {
      markFirstRunDone(accountId);
      setDone(true);
    },
  };
}
