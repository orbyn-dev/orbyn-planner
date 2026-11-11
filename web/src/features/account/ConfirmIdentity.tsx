import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiFailure } from "../../core/account/errors";
import { Icon } from "../../ui/primitives/Icon";
import { BusyButton } from "../../ui/primitives/BusyButton";
import { Modal } from "../../ui/primitives/Modal";
import { useAuth } from "../../state/account";
import { SecondFactorNeeded, confirmIdentity } from "../../state/services/flows";
import { describeError } from "./messages";

/** The person closed the prompt: the action was not done, and nothing is to be shown about it. */
export class ReauthCancelled extends Error {
  constructor() {
    super("Cancelled.");
    this.name = "ReauthCancelled";
  }
}

export const isReauthRequired = (e: unknown): boolean => e instanceof ApiFailure && e.code === "reauthentication_required";

/** “in 12 minutes”, then “in under a minute” (Planner Designs v73 p-reauth-throttled). */
export function retryText(seconds: number): string {
  if (seconds < 60) return "in under a minute";
  const minutes = Math.ceil(seconds / 60);
  return `in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

type Problem = { kind: "wrong" } | { kind: "throttled"; until: number } | { kind: "network" } | { kind: "other"; message: string };

/**
 * “Confirm it’s you” (Planner Designs v73 p-reauth and its states): the password again, before an action the engine only allows after a
 * sign-in from the last ten minutes. Confirm signs in again with this device's keys and then calls `onConfirmed`, which does the original
 * action once more. The password is not kept: the field is cleared after use and the sign-in zeroes its bytes.
 */
export function ConfirmIdentity({ subject, onConfirmed, onCancel }: { subject?: ReactNode; onConfirmed: () => Promise<void>; onCancel: () => void }) {
  const auth = useAuth()!;
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const waitUntil = problem?.kind === "throttled" ? problem.until : 0;
  useEffect(() => {
    if (!waitUntil) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= waitUntil) setProblem((p) => (p?.kind === "throttled" ? null : p));
    }, 1000);
    return () => clearInterval(timer);
  }, [waitUntil]);

  const throttled = waitUntil > now;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || throttled || password === "") return;
    setBusy(true);
    setProblem(null);
    try {
      await confirmIdentity(auth.services, auth.session!, password);
    } catch (e) {
      setBusy(false);
      if (e instanceof SecondFactorNeeded) {
        e.cancel();
        setProblem({ kind: "other", message: "This account needs a code to sign in again. Sign out and back in, then try again." });
      } else if (e instanceof ApiFailure && e.code === "login_failed") {
        setPassword(""); // a wrong password is not kept
        setProblem({ kind: "wrong" });
      } else if (e instanceof ApiFailure && e.code === "too_many_attempts") {
        setProblem({ kind: "throttled", until: Date.now() + (e.retryAfter ?? 600) * 1000 });
        setNow(Date.now());
      } else if (e instanceof ApiFailure && e.code === "network") setProblem({ kind: "network" });
      else setProblem({ kind: "other", message: describeError(e) });
      return;
    }
    setPassword("");
    try {
      await onConfirmed();
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setPassword("");
    onCancel();
  };

  return (
    <Modal label="Confirm it’s you" onClose={busy ? () => undefined : cancel}>
      <form onSubmit={(e) => void submit(e)} aria-label="Confirm it’s you" className="reauth-form">
        <b className="card-title">Confirm it’s you</b>
        <p className="t2">Enter your password to continue.</p>
        {subject && <p className="reauth-subject t2"><Icon name="shield" small /> {subject}</p>}
        {problem?.kind === "throttled" && throttled && (
          <p className="reauth-note" role="alert"><Icon name="clock" small /> Too many attempts. Try again {retryText(Math.ceil((waitUntil - now) / 1000))}.</p>
        )}
        {problem?.kind === "network" && (
          <p className="reauth-note bad" role="alert"><Icon name="alert" small /> Couldn’t reach Orbyn. Check your connection and try again. Nothing was changed.</p>
        )}
        <div className="fld">
          <label htmlFor="reauth-password">Password</label>
          <input
            id="reauth-password"
            className={problem?.kind === "wrong" ? "field bad" : "field"}
            type="password"
            autoComplete="current-password"
            data-autofocus
            value={password}
            disabled={busy}
            aria-invalid={problem?.kind === "wrong" || undefined}
            aria-describedby={problem?.kind === "wrong" ? "reauth-wrong" : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
          {problem?.kind === "wrong" && <small id="reauth-wrong" className="err" role="alert">That isn’t your password. Check it and try again.</small>}
        </div>
        {problem?.kind === "other" && <p className="err" role="alert">{problem.message}</p>}
        <p className="t3 small">You won’t be asked again if you signed in within the last 10 minutes.</p>
        <div className="dialog-actions">
          <button type="button" className="ghost" disabled={busy} onClick={cancel}>Cancel</button>
          <BusyButton
            busy={busy}
            idle={problem?.kind === "network" ? "Try again" : "Confirm"}
            working="Checking…"
            className="btn"
            disabled={password === "" || throttled}
            onClick={(e) => void submit(e as unknown as FormEvent)}
          />
        </div>
      </form>
    </Modal>
  );
}

interface Asking {
  subject: ReactNode;
  retry: () => void;
  cancel: () => void;
}

/**
 * Runs an action that may be answered “sign in again”: `run(subject, action)` does it, and when the engine asks for the password
 * the prompt (`prompt`, to render) takes over, and on Confirm the same action runs once more. `run` rejects with `ReauthCancelled`
 * if the person closes the prompt.
 */
export function useReauth(): { run: <T>(subject: ReactNode, action: () => Promise<T>) => Promise<T>; prompt: ReactNode } {
  const [asking, setAsking] = useState<Asking | null>(null);
  const run = useCallback(<T,>(subject: ReactNode, action: () => Promise<T>): Promise<T> => {
    return action().catch((e: unknown) => {
      if (!isReauthRequired(e)) throw e;
      return new Promise<T>((resolve, reject) => {
        setAsking({
          subject,
          retry: () => {
            // The retry is the original action; whatever it does ends the prompt.
            setAsking(null);
            action().then(resolve, reject);
          },
          cancel: () => {
            setAsking(null);
            reject(new ReauthCancelled());
          },
        });
      });
    });
  }, []);
  const prompt = asking ? <ConfirmIdentity subject={asking.subject} onConfirmed={async () => asking.retry()} onCancel={asking.cancel} /> : null;
  return { run, prompt };
}
