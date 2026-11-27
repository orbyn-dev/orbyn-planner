// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { navigatePage } from "./navigation.mjs";

afterEach(() => vi.useRealTimers());

it("registers before navigation and removes listeners after a fast load", async () => {
  const handlers = new Set();
  const socket = new EventTarget();
  const remove = vi.spyOn(socket, "removeEventListener");
  await navigatePage(async () => {
    for (const handler of handlers) handler({ sessionId: "test", method: "Page.loadEventFired" });
    return {};
  }, handlers, socket, "test", "http://localhost/today");
  expect(handlers.size).toBe(0);
  expect(remove).toHaveBeenCalledWith("close", expect.any(Function));
});

it("rejects and cleans up when the socket closes before a load", async () => {
  const handlers = new Set();
  const socket = new EventTarget();
  const result = navigatePage(async () => ({}), handlers, socket, "test", "http://localhost/today");
  socket.dispatchEvent(new Event("close"));
  await expect(result).rejects.toThrow("disconnected");
  expect(handlers.size).toBe(0);
});

it.each(["deadline", "disconnect"])("bounds an unanswered command even when a fast load has already fired: %s", async (reason) => {
  vi.useFakeTimers();
  const handlers = new Set();
  const socket = new EventTarget();
  const result = navigatePage(() => {
    for (const handler of handlers) handler({ sessionId: "test", method: "Page.loadEventFired" });
    return new Promise(() => {});
  }, handlers, socket, "test", "http://localhost/today", 10);
  const rejected = expect(result).rejects.toThrow(reason === "deadline" ? "timed out" : "disconnected");
  if (reason === "deadline") await vi.advanceTimersByTimeAsync(10);
  else socket.dispatchEvent(new Event("close"));
  await rejected;
  expect(handlers.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("bounds a missing load event and cleans up after a command failure", async () => {
  vi.useFakeTimers();
  const handlers = new Set();
  const socket = new EventTarget();
  const result = navigatePage(async () => ({}), handlers, socket, "test", "http://localhost/today", 10);
  const rejected = expect(result).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(10);
  await rejected;
  expect(handlers.size).toBe(0);
  await expect(navigatePage(async () => { throw new Error("command failed"); }, handlers, socket, "test", "http://localhost/today")).rejects.toThrow("command failed");
  expect(handlers.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
