/** What went wrong, in words a person can use. */
const MESSAGES: Record<string, string> = {
  too_many_attempts: "Too many attempts. Wait a little while, then try again.",
  too_many_uploads: "Syncing too fast. It will resume in a moment.",
  zone_not_found: "That list or calendar isn’t there any more.",
  zone_deleted: "That list or calendar was deleted on another device.",
  email_unavailable: "That email can’t be used for a new account. If it’s yours, sign in instead.",
  login_failed: "That email and password don’t match.",
  invalid_email_code: "That code didn’t work.",
  invite_invalid: "This invite code didn’t work. Check it and try again.",
  second_factor_required: "Enter the code from your authenticator app to finish signing in.",
  second_factor_failed: "That code didn’t work.",
  protection_conflict: "Another device changed the protection level first. Check it, then try again.",
  invalid_protection: "That protection setting isn’t valid.",
  too_many_changes: "The protection level was changed too many times. Try again later.",
  reauthentication_required: "For safety, sign in again to do this.",
  deletion_scheduled: "Your account is scheduled for deletion. Cancel the deletion first to do this.",
  invalid_cancel_token: "This cancel link isn’t valid any more. It may have been used already, or the deletion may be past its time.",
  device_proof_required: "This device couldn’t prove the request. Try again, and check that this device’s clock is right.",
  totp_already_enabled: "Two-factor is already on for this account.",
  totp_not_enabled: "Two-factor isn’t on for this account.",
  device_not_trusted: "This device hasn’t been approved yet. Approve it from a device you already trust.",
  last_trusted_device: "This is your last trusted device. Approve another device first, then remove this one.",
  approval_expired: "That approval ran out of time or was closed. Start again from a trusted device. If this keeps happening, check that this device’s clock is right.",
  approval_out_of_order: "That approval isn’t at that step. Start again.",
  approval_not_confirmed: "The trusted device hasn’t confirmed yet.",
  invalid_commitment: "The two devices didn’t agree, so the approval was closed. Start again.",
  invalid_email: "Enter a valid email address.",
  invalid_device_name: "This device’s name isn’t valid.",
  invalid_signature: "This device couldn’t be verified. Try again.",
  device_key_conflict: "This device is already registered to another account.",
  not_found: "That isn’t there any more.",
  unauthorized: "Your session ended. Sign in again.",
  accounts_unavailable: "Sign-in isn’t set up on this server yet.",
  invalid_request: "That request wasn’t valid. Try again.",
  payload_too_large: "That request was too large.",
  internal: "Something went wrong on the server. Try again in a moment.",
  network: "Can’t reach the server. Check your connection and try again.",
};

/** A failed call: `code` is the engine's error code (or `network`), `message` is for the person. */
export class ApiFailure extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    /** The server's own message, kept for codes that carry detail, such as the attempts left. */
    readonly serverMessage: string = "",
    /** The whole error body, for answers that carry more than a code (a `record_changed` has the conflicts). */
    readonly body: unknown = null,
    /** Seconds the server asked to wait (`Retry-After`), if it did. */
    readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "ApiFailure";
  }
}

export function plainMessage(code: string): string {
  if (code === "wrong_code") return "The digits didn’t match, so the approval was closed. Start again.";
  return MESSAGES[code] ?? "Something went wrong. Try again.";
}
