import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiFailure } from "../../core/account/errors";
import { Icon } from "../../ui/primitives/Icon";
import { BusyButton } from "../../ui/primitives/BusyButton";
import { Modal } from "../../ui/primitives/Modal";
import { PageHeader } from "../../ui/primitives/EmptyState";
import { useUi } from "../../ui/product/UiProvider";
import { TOAST_BRIEF_MS } from "../../styles/tokens";
import { useAuth } from "../../state/account";
import { confirmTotp, disableTotp, enrolTotp } from "../../state/services/flows";
import { QrCode, ReauthCancelled, describeError, digits, groupSecret, recoveryFile, useReauth } from "../account";
import { saveFile } from "../export";

type Phase =
  | { step: "loading" }
  | { step: "error" }
  | { step: "off" }
  | { step: "on" }
  | { step: "setup"; secret: string; uri: string; expired: boolean }
  | { step: "codes"; codes: string[] };

/**
 * Two-factor sign-in on the account site (Account Designs v72 ar-2fa-*): off, set up (a QR code and a key that work for ten minutes, then
 * a six-digit code), recovery codes shown once, on, and turn off. The engine's recent-sign-in rule is answered by "Confirm it’s you".
 * Lives at `/protection/two-factor`, the address the Engineering app's "Manage two-factor" opens.
 */
export function TwoFactorPage() {
  const auth = useAuth()!;
  const [phase, setPhase] = useState<Phase>({ step: "loading" });
  const [turningOff, setTurningOff] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const read = useCallback(
    () =>
      auth.services.api.currentDevice().then(
        (d) => setPhase({ step: d.totp_enabled ? "on" : "off" }),
        () => setPhase({ step: "error" }),
      ),
    [auth.services],
  );
  /** Asks the engine again, showing "Checking…" meanwhile. */
  const load = useCallback(() => {
    setPhase({ step: "loading" });
    return read();
  }, [read]);
  useEffect(() => {
    void read();
  }, [read]);

  const sub = phase.step === "setup" ? "Protection · Turn on" : phase.step === "codes" ? "Protection · Recovery codes" : "Protection";
  return (
    <>
      <PageHeader title="Two-factor sign-in" sub={sub} />
      <div className="pad" style={{ maxWidth: "var(--sp-760)" }}>
        {phase.step === "loading" && <p className="t3" role="status">Checking…</p>}
        {phase.step === "error" && (
          <div className="banner err" role="alert">
            <Icon name="alert" small />
            Couldn’t check whether two-factor is on.
            <span className="end"><button type="button" className="btn sm" onClick={() => void load()}>Try again</button></span>
          </div>
        )}
        {phase.step === "off" && (
          <div className="srow">
            <div className="lab2">
              <b>Two-factor sign-in</b>
              <small>Off · ask for a code from an authenticator app when you sign in on a new device</small>
            </div>
            <StartButton label="Turn on" onStarted={(secret, uri) => setPhase({ step: "setup", secret, uri, expired: false })} onAlreadyOn={() => void load()} onError={setStartError} />
          </div>
        )}
        {phase.step === "off" && startError && (
          <p className="err" role="alert">{startError}</p>
        )}
        {phase.step === "setup" && (
          <SetupCard
            secret={phase.secret}
            uri={phase.uri}
            expired={phase.expired}
            onExpired={() => setPhase({ ...phase, expired: true })}
            onRestart={(secret, uri) => setPhase({ step: "setup", secret, uri, expired: false })}
            onCancel={() => void load()}
            onDone={(codes) => setPhase({ step: "codes", codes })}
          />
        )}
        {phase.step === "codes" && <CodesCard codes={phase.codes} onDone={() => void load()} />}
        {phase.step === "on" && (
          <div className="srow">
            <div className="lab2">
              <b>Two-factor sign-in</b>
              <small>On · authenticator app</small>
            </div>
            <button type="button" className="ghost sm" onClick={() => setTurningOff(true)}>Turn off</button>
          </div>
        )}
      </div>
      {turningOff && <TurnOffDialog onClose={() => setTurningOff(false)} onDone={() => { setTurningOff(false); void load(); }} />}
    </>
  );
}

/** Starts set-up: a new secret from the engine (after "Confirm it’s you" if the sign-in is old). */
function StartButton({ label, onStarted, onAlreadyOn, onError, className = "btn sm" }: { label: string; onStarted: (secret: string, uri: string) => void; onAlreadyOn: () => void; onError?: (message: string | null) => void; className?: string }) {
  const auth = useAuth()!;
  const { run, prompt } = useReauth();
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    onError?.(null);
    try {
      const e = await run("To turn on two-factor", () => enrolTotp(auth.services, auth.session!));
      onStarted(e.secret, e.uri);
    } catch (e) {
      if (e instanceof ReauthCancelled) setBusy(false);
      else if (e instanceof ApiFailure && e.code === "totp_already_enabled") onAlreadyOn();
      else {
        onError?.(describeError(e));
        setBusy(false);
      }
    }
  };
  return (
    <>
      <BusyButton busy={busy} idle={label} working="Starting…" className={className} onClick={() => void start()} />
      {prompt}
    </>
  );
}

function SetupCard({ secret, uri, expired, onExpired, onRestart, onCancel, onDone }: { secret: string; uri: string; expired: boolean; onExpired: () => void; onRestart: (secret: string, uri: string) => void; onCancel: () => void; onDone: (codes: string[]) => void }) {
  const auth = useAuth()!;
  const ui = useUi();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyNote, setKeyNote] = useState<string | null>(null);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      ui.showToast("Key copied.", undefined, { ms: TOAST_BRIEF_MS });
    } catch {
      setKeyNote("Couldn’t copy. Select the key and copy it.");
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || expired || digits(code).length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const done = await confirmTotp(auth.services, auth.session!, digits(code));
      setCode("");
      onDone(done.recovery_codes);
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiFailure && e.code === "totp_setup_expired") {
        setCode(""); // the old key is dimmed and the field is off until a new key is made
        onExpired();
      }
      else if (e instanceof ApiFailure && e.code === "second_factor_failed") setError("That code isn’t right. Check the time on your device and try again.");
      else setError(describeError(e));
    }
  };

  return (
    <form className="card tf-card" onSubmit={(e) => void submit(e)} aria-label="Turn on two-factor">
      {expired && (
        <div className="banner" role="alert">
          <Icon name="clock" small />
          This key has expired. Start again to get a new one.
          <span className="end"><StartButton label="Start again" onStarted={onRestart} onAlreadyOn={onCancel} /></span>
        </div>
      )}
      <div className="tf-key" style={expired ? { opacity: 0.45 } : undefined}>
        <QrCode value={uri} label="QR code for your authenticator app" />
        <div className="tf-key-text">
          <b>1. Add Orbyn to your authenticator app</b>
          <span className="t3 small">Scan the code, or <a className="link" href={uri}>open it in your authenticator app</a> on this device.</span>
          <span className="t3 small">Can’t scan? Enter this key instead:</span>
          <div className="tf-secret">
            <code className="mono" aria-label="Secret key">{groupSecret(secret)}</code>
            <button type="button" className="ghost sm" disabled={expired} onClick={() => void copyKey()}>Copy</button>
          </div>
          {keyNote && <span className="t3 small" role="status">{keyNote}</span>}
          <span className="t3 small">This key works for 10 minutes.</span>
        </div>
      </div>
      <div className="fld" style={{ maxWidth: "var(--sp-320)" }}>
        <label htmlFor="tf-code">2. Enter the 6-digit code from the app</label>
        <input
          id="tf-code"
          className={error ? "field bad" : "field"}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          placeholder="6-digit code"
          value={code}
          disabled={expired || busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "tf-code-error" : undefined}
          onChange={(e) => setCode(e.target.value)}
        />
        {error && <small id="tf-code-error" className="err" role="alert">{error}</small>}
      </div>
      <div className="tf-actions">
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn" disabled={busy || expired || digits(code).length !== 6}>Turn on</button>
      </div>
    </form>
  );
}

function CodesCard({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const ui = useUi();
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      ui.showToast("Copied. Paste them somewhere safe, then copy something else so they don’t stay on your clipboard.", undefined, { ms: TOAST_BRIEF_MS });
    } catch {
      setNote("Couldn’t copy. Select the codes and copy them, or download them.");
    }
  };
  const download = async () => {
    try {
      setNote((await saveFile("orbyn-recovery-codes.txt", "text/plain", recoveryFile(codes))) ? "Saved." : null);
    } catch {
      setNote("Couldn’t save the file. Copy the codes instead.");
    }
  };
  return (
    <div className="card tf-card">
      <b>Save your recovery codes</b>
      <span className="t3 small">Each code works once if you lose your authenticator app. They are shown only here, only now. The apps never show them.</span>
      <ul className="tf-codes mono" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="tf-actions" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="ghost" onClick={() => void copy()}>Copy</button>
        <button type="button" className="ghost" onClick={() => void download()}>Download</button>
      </div>
      {note && <p className="t3 small" role="status">{note}</p>}
      <label className="small tf-saved">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I saved them
      </label>
      <div className="tf-actions">
        <button type="button" className="btn" disabled={!saved} onClick={onDone}>Done</button>
      </div>
    </div>
  );
}

function TurnOffDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const auth = useAuth()!;
  const { run, prompt } = useReauth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await run("To turn off two-factor", () => disableTotp(auth.services, auth.session!));
      onDone();
    } catch (e) {
      if (e instanceof ReauthCancelled) onClose();
      else if (e instanceof ApiFailure && e.code === "totp_not_enabled") onDone();
      else {
        setError(describeError(e));
        setBusy(false);
      }
    }
  };
  if (prompt) return <>{prompt}</>;
  return (
    <Modal label="Turn off two-factor" onClose={busy ? () => undefined : onClose}>
      <b className="card-title">Turn off two-factor?</b>
      <p className="t2">Signing in on a new device will only need your password. Your recovery codes stop working.</p>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="ghost" data-autofocus onClick={onClose}>Cancel</button>
        <button type="button" className="btn" disabled={busy} onClick={() => void submit()}>Turn off</button>
      </div>
    </Modal>
  );
}
