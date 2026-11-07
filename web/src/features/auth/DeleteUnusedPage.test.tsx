import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteUnusedPage, forgetDeleteUnusedTokenForTests } from "./DeleteUnusedPage";

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };

const fetchMock = vi.fn();
const TOKEN = "dG9rZW4tdG9rZW4tdG9rZW4";
const answer = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const press = () => userEvent.click(screen.getByRole("button", { name: "Delete this account" }));

beforeEach(() => {
  forgetDeleteUnusedTokenForTests();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", `/delete-unused#${TOKEN}`);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the Start over link", () => {
  it("opening it only shows the question: the token leaves the address and nothing is sent", () => {
    render(<StrictMode><DeleteUnusedPage /></StrictMode>);
    expect(screen.getByRole("heading", { name: "Delete this empty account?" })).toBeInTheDocument();
    expect(screen.getByText(/may release the code so you can use it again/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancel" })).toBeInTheDocument();
    expect(window.location.href).not.toContain(TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute("content")).toBe("no-referrer");
  });

  it("pressing the button posts the token once; an invite released shows the released screen", async () => {
    fetchMock.mockResolvedValue(answer(200, { invite_released: true }));
    render(<DeleteUnusedPage />);
    await press();
    expect(await screen.findByRole("heading", { name: "Account deleted" })).toBeInTheDocument();
    expect(screen.getByText("Your invite code works again. You can use it to sign up once more. It keeps its original expiry.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign up again" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v1\/accounts\/delete-unused\/confirm$/);
    expect(url).not.toContain(TOKEN);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ token: TOKEN });
    expect(init.credentials).toBe("omit");
  });

  it("nothing released (no invite, or released before) shows the other done screen", async () => {
    fetchMock.mockResolvedValue(answer(200, { invite_released: false }));
    render(<DeleteUnusedPage />);
    await press();
    expect(await screen.findByText("The account was deleted. No invite code was released.")).toBeInTheDocument();
    expect(screen.queryByText(/works again/)).toBeNull();
  });

  it("a link that does not work any more, and an account that is not empty, are two different states", async () => {
    fetchMock.mockResolvedValueOnce(answer(400, { code: "invalid_delete_unused_token", message: "x" }));
    const first = render(<DeleteUnusedPage />);
    await press();
    expect(await screen.findByRole("heading", { name: "This link doesn’t work any more" })).toBeInTheDocument();
    first.unmount();
    forgetDeleteUnusedTokenForTests();
    window.history.replaceState(null, "", `/delete-unused#${TOKEN}`);
    fetchMock.mockResolvedValueOnce(answer(409, { code: "delete_unused_not_possible", message: "x" }));
    render(<DeleteUnusedPage />);
    await press();
    expect(await screen.findByRole("heading", { name: "This account can’t be deleted this way" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy address" })).toBeInTheDocument();
  });

  it("an address with no token is the not-working state, and sends nothing", () => {
    window.history.replaceState(null, "", "/delete-unused");
    forgetDeleteUnusedTokenForTests();
    render(<DeleteUnusedPage />);
    expect(screen.getByRole("heading", { name: "This link doesn’t work any more" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a network failure leaves the account in place and Try again presses again", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    render(<DeleteUnusedPage />);
    await press();
    expect(await screen.findByRole("heading", { name: "Couldn’t delete the account" })).toBeInTheDocument();
    expect(screen.getByText("Orbyn didn’t answer, so nothing changed. The account still exists.")).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(answer(200, { invite_released: false }));
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Account deleted" })).toBeInTheDocument();
    expect(JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string)).toEqual({ token: TOKEN });
  });

  it("a double press posts once while the first is out", async () => {
    let finish: (r: Response) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (finish = resolve)));
    render(<DeleteUnusedPage />);
    await press();
    expect(await screen.findByText("Checking your link")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete this account" })).toBeNull();
    finish(answer(200, { invite_released: false }));
    await screen.findByRole("heading", { name: "Account deleted" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Cancel comes first and the red Delete this account last", () => {
    render(<DeleteUnusedPage />);
    const card = screen.getByRole("group", { name: "Delete this empty account?" });
    const actions = [...card.querySelectorAll("a, button")].map((e) => e.textContent);
    expect(actions).toEqual(["Cancel", "Delete this account"]);
    expect(screen.getByRole("button", { name: "Delete this account" })).toHaveClass("danger");
  });

  it("a 429 is a neutral banner with nothing to press, not 'Orbyn didn’t answer'", async () => {
    fetchMock.mockResolvedValue(answer(429, { code: "too_many_attempts", message: "x" }));
    render(<DeleteUnusedPage />);
    await press();
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many tries. Wait a while, then try again.");
    expect(screen.queryByText(/didn’t answer/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("Sign up again, Back to sign-up and Sign in open their own screens", async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { invite_released: false }));
    const first = render(<DeleteUnusedPage />);
    await press();
    expect(await screen.findByRole("link", { name: "Sign up again" })).toHaveAttribute("href", "/sign-up");
    first.unmount();
    window.history.replaceState(null, "", "/delete-unused");
    forgetDeleteUnusedTokenForTests();
    render(<DeleteUnusedPage />);
    expect(screen.getByRole("link", { name: "Back to sign-up" })).toHaveAttribute("href", "/sign-up");
  });

  it("is isolated: main.tsx loads it before the app, and nothing it imports reaches accounts, stores, sync or the wasm module", () => {
    const root = `${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src`;
    const main = fs.readFileSync(`${root}/main.tsx`, "utf8");
    const route = main.indexOf('"/delete-unused"');
    expect(route).toBeGreaterThan(-1);
    expect(main.indexOf('import("./bootApp")')).toBeGreaterThan(route);
    const seen = new Set<string>();
    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(/(?:from|import\(|^import)\s*"(\.[^"]+)"/gm)) {
        const base = new URL(m[1]!, `file://${file}`).pathname;
        const target = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"].map((x) => base + x).find((x) => { try { return /\.(ts|tsx)$/.test(x) && fs.readFileSync(x, "utf8") !== undefined; } catch { return false; } });
        if (target) walk(target);
      }
    };
    walk(`${root}/features/auth/DeleteUnusedPage.tsx`);
    const reached = [...seen].map((f) => f.slice(root.length));
    for (const f of reached) expect(f, f).not.toMatch(/^\/(auth|store|sync|app)\/|wasm|realCrypto|authCrypto|keyStore|tokenStore/);
  });
});
