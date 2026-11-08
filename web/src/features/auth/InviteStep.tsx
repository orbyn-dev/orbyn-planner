import { Icon } from "../../components/Icon";
import { useState, type FormEvent } from "react";
import { ApiFailure } from "../../api/auth";
import { useAuth } from "../../auth/AuthProvider";
import { BusyButton } from "../../components/BusyButton";

/** The four bars and the line under them: "Step 1 of 4 · Invite code" (Planner Designs p-signup-invite-default and the sign-up frames). */
export function StepBar({ step, label }: { step: 1 | 2 | 3 | 4; label: string }) {
  return (
    <div className="stepbar">
      <span className="bars" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => <i key={n} className={n <= step ? "on" : undefined} />)}
      </span>
      <span className="t3 small">Step {step} of 4 · {label}</span>
    </div>
  );
}

const LENGTH = 16;

/** What the field shows: only letters and digits, upper case, in groups of four with dashes, at most 16 characters. Paste in any shape. */
export function formatInvite(text: string): string {
  const chars = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, LENGTH);
  return chars.replace(/(.{4})(?=.)/g, "$1-");
}

export const INVITE_REFUSED = "This invite code didn’t work. Check it and try again.";
const LIMITED = "Too many tries. Try again later.";
const NETWORK = "Couldn’t check the code. Nothing was changed.";

type Phase = "idle" | "checking" | "refused" | "limited" | "network";

/**
 * Step 1 of 4: the invite code, before the email is asked, so an error can never show anything about an email. The code is checked
 * without being spent (`POST /v1/invites/check`); it is used up when the account is made. One refusal covers a code that is unknown,
 * used, expired or revoked. After ten failures an hour the engine answers 429 and the field and Continue are disabled, with no wait
 * time shown. There is no way to ask for a code here. (p-signup-invite-default, -filled, -checking, -error, -limited, -network.)
 */
export function InviteStep({ onAccepted, go }: { onAccepted: (invite: string) => void; go: (screen: "signin") => void }) {
  const auth = useAuth()!;
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const complete = code.replace(/-/g, "").length === LENGTH;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!complete || phase === "checking" || phase === "limited") return;
    setPhase("checking");
    try {
      await auth.services.api.inviteCheck({ invite: code });
      onAccepted(code);
    } catch (e) {
      if (e instanceof ApiFailure && e.code === "invite_invalid") setPhase("refused");
      else if (e instanceof ApiFailure && e.code === "too_many_attempts") setPhase("limited");
      else setPhase("network");
    }
  };

  const refused = phase === "refused";
  return (
    <form className="authcard invite" onSubmit={(e) => void submit(e)} aria-label="Sign up with an invite" noValidate>
      <StepBar step={1} label="Invite code" />
      <h1 className="auth-title">Orbyn is invite-only for now</h1>
      {phase === "limited" && <div className="banner warn" role="alert"><Icon name="clock" small />{LIMITED}</div>}
      {phase === "network" && <div className="banner warn" role="alert"><Icon name="alert" small />{NETWORK}</div>}
      <div className="form" style={{ width: "auto" }}>
        <label htmlFor="su-invite">Invite code</label>
        <input
          id="su-invite"
          className={refused ? "field mono-code err" : "field mono-code"}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          value={code}
          disabled={phase === "checking" || phase === "limited"}
          aria-invalid={refused || undefined}
          aria-describedby={refused ? "su-invite-error" : undefined}
          onChange={(e) => {
            setCode(formatInvite(e.target.value));
            if (phase !== "limited") setPhase("idle");
          }}
          autoFocus
        />
        {refused && <small id="su-invite-error" role="alert" className="err">{INVITE_REFUSED}</small>}
      </div>
      <span className="t3 small">Paste it with or without dashes.</span>
      <BusyButton
        type="submit"
        className="btn lg"
        busy={phase === "checking"}
        disabled={!complete || phase === "limited"}
        idle={phase === "network" ? "Try again" : "Continue"}
        working="Checking…"
      />
      <span className="t3 small">
        Already have an account? <button type="button" className="link-btn" onClick={() => go("signin")}>Sign in</button>
      </span>
      <button type="button" className="link-btn quiet-link" onClick={auth.overlay ? auth.closeAuth : auth.useWithoutAccount}>
        {auth.overlay ? "Back to the planner" : "Use without an account"}
      </button>
    </form>
  );
}
