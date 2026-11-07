import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteUnusedPage, forgetDeleteUnusedTokenForTests } from "./DeleteUnusedPage";

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
});
