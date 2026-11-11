import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../../core/account/errors";
import { createMemoryKeyStore } from "../../data/account/keyStore";
import { createAuthServices, type AuthServices } from "../../state/services/auth";
import { AuthProvider } from "../../state/account";
import { FakeAuthCrypto } from "../../testing/FakeAuthCrypto";
import { createMockEngine, type MockEngine } from "../../testing/MockEngine";
import { signedUp } from "../../testing/signedUp";
import { ReauthCancelled, retryText, useReauth } from "./ConfirmIdentity";

const crypto = new FakeAuthCrypto();
const SAM = { name: "Sam", email: "sam@example.com", password: "correct horse battery" };
const time = Date.UTC(2026, 10, 7, 10, 0, 0);

let engine: MockEngine;
let services: AuthServices;
/** While true, nothing reaches the engine. */
let offline = false;

const reauth = () => new ApiFailure("reauthentication_required", 401, "For safety, sign in again to do this.");

function Harness({ action, onResult }: { action: () => Promise<string>; onResult: (r: string) => void }) {
  const { run, prompt } = useReauth();
  return (
    <>
      <button type="button" onClick={() => void run(<>To remove Tablet</>, action).then(onResult, (e: unknown) => onResult(e instanceof ReauthCancelled ? "cancelled" : "failed"))}>Go</button>
      {prompt}
    </>
  );
}

async function open(action: () => Promise<string>) {
  const onResult = vi.fn();
  render(
    <AuthProvider services={services}>
      <Harness action={action} onResult={onResult} />
    </AuthProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Go" }));
  return { onResult, dialog: await screen.findByRole("dialog", { name: "Confirm it’s you" }) };
}

beforeEach(async () => {
  offline = false;
  engine = createMockEngine(() => time);
  services = createAuthServices({ fetch: ((input: RequestInfo | URL, init?: RequestInit) => (offline ? Promise.reject(new TypeError("offline")) : engine.fetch(input, init))) as typeof fetch, baseUrl: "http://e.test", keys: createMemoryKeyStore(), crypto: () => crypto, wrapSecret: async () => new Uint8Array(32).fill(4), now: () => time });
  await signedUp(engine, services, SAM);
  await services.tokens.load(time);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Confirm it’s you", () => {
  it("does nothing when the action is allowed", async () => {
    const action = vi.fn(async () => "done");
    const onResult = vi.fn();
    render(
      <AuthProvider services={services}>
        <Harness action={action} onResult={onResult} />
      </AuthProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Go" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith("done"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("asks for the password, names what it is for, turns Confirm on once something is typed, and sends the same action again after it", async () => {
    const action = vi.fn().mockRejectedValueOnce(reauth()).mockResolvedValue("removed");
    const { onResult, dialog } = await open(action);
    expect(within(dialog).getByText("Enter your password to continue.")).toBeInTheDocument();
    expect(within(dialog).getByText("To remove Tablet")).toBeInTheDocument();
    expect(within(dialog).getByText("You won’t be asked again if you signed in within the last 10 minutes.")).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Confirm" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Password"), SAM.password);
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() => expect(onResult).toHaveBeenCalledWith("removed"));
    expect(action).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).toBeNull();
    // The sign-in that made the session fresh is the one the prompt did.
    expect(engine.calls.filter((c) => c.path === "/v1/sessions/login/finish").length).toBe(1);
  });

  it("says a wrong password under the field, clears it, and does not do the action", async () => {
    const action = vi.fn().mockRejectedValueOnce(reauth()).mockResolvedValue("removed");
    const { onResult, dialog } = await open(action);
    const field = within(dialog).getByLabelText("Password");
    await userEvent.type(field, "not the password");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    expect(await within(dialog).findByText("That isn’t your password. Check it and try again.")).toBeInTheDocument();
    expect(field).toHaveValue("");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(action).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
  });

  it("says nothing was changed when Orbyn can’t be reached, keeps the password typed, and offers Try again", async () => {
    const action = vi.fn().mockRejectedValueOnce(reauth()).mockResolvedValue("removed");
    const { onResult, dialog } = await open(action);
    const field = within(dialog).getByLabelText("Password");
    await userEvent.type(field, SAM.password);
    offline = true;
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    expect(await within(dialog).findByText("Couldn’t reach Orbyn. Check your connection and try again. Nothing was changed.")).toBeInTheDocument();
    expect(field).toHaveValue(SAM.password);
    expect(onResult).not.toHaveBeenCalled();
    offline = false;
    await userEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith("removed"));
  });

  it("Cancel closes it and the action is not done", async () => {
    const action = vi.fn().mockRejectedValueOnce(reauth()).mockResolvedValue("removed");
    const { onResult, dialog } = await open(action);
    await userEvent.type(within(dialog).getByLabelText("Password"), "half typed");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith("cancelled"));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("too many attempts: says when to try again, counts down live, and keeps Confirm off until then", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    const action = vi.fn().mockRejectedValueOnce(reauth()).mockResolvedValue("removed");
    engine.refuseNext("/v1/sessions/login/start", 429, "too_many_attempts", "Too many attempts.", 1, 12 * 60);
    const onResult = vi.fn();
    render(
      <AuthProvider services={services}>
        <Harness action={action} onResult={onResult} />
      </AuthProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Go" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm it’s you" });
    fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: SAM.password } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    });
    await waitFor(() => expect(within(dialog).getByText("Too many attempts. Try again in 12 minutes.")).toBeInTheDocument());
    expect(within(dialog).getByRole("button", { name: "Confirm" })).toBeDisabled();
    await act(async () => {
      vi.advanceTimersByTime(11 * 60_000 + 30_000);
    });
    expect(within(dialog).getByText("Too many attempts. Try again in under a minute.")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(40_000);
    });
    expect(within(dialog).queryByText(/Too many attempts/)).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Confirm" })).toBeEnabled();
  });
});

describe("retryText", () => {
  it("counts minutes, then says under a minute", () => {
    expect(retryText(12 * 60)).toBe("in 12 minutes");
    expect(retryText(61)).toBe("in 2 minutes");
    expect(retryText(60)).toBe("in 1 minute");
    expect(retryText(59)).toBe("in under a minute");
  });
});
