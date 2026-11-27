import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { LazyRoute } from "./LazyRoute";

it("shows a loading state and renders a direct route after its module loads", async () => {
  let resolve!: (module: { default: () => React.JSX.Element }) => void;
  const load = () => new Promise<{ default: () => React.JSX.Element }>((done) => { resolve = done; });
  render(<LazyRoute load={load} pageProps={{}} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  resolve({ default: () => <h1>Calendar</h1> });
  expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument();
});

it("reports a chunk failure and retries the module when requested", async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error("chunk unavailable")).mockResolvedValueOnce({ default: () => <h1>Settings</h1> });
  render(<LazyRoute load={load} pageProps={{}} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t load");
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
  expect(load).toHaveBeenCalledTimes(2);
});

it("loads a new route when the loader changes without remounting its parent", async () => {
  const first = () => Promise.resolve({ default: () => <h1>First page</h1> });
  const second = () => Promise.resolve({ default: () => <h1>Second page</h1> });
  const { rerender } = render(<LazyRoute load={first} pageProps={{}} />);
  expect(await screen.findByRole("heading", { name: "First page" })).toBeInTheDocument();
  rerender(<LazyRoute load={second} pageProps={{}} />);
  expect(await screen.findByRole("heading", { name: "Second page" })).toBeInTheDocument();
});
