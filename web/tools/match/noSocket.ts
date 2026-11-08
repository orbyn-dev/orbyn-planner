// DEVELOPMENT AND TESTS ONLY. The planner's sync opens a live socket to its engine. The kit has none, so the page's socket is replaced
// by one that never opens and never sends: the sync passes run on the in-page mock engine, and nothing leaves the page.
class NeverOpens {
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  close(): void {
    this.readyState = 3;
  }
  send(): void {}
}

export function installNoSocket(): void {
  Reflect.set(globalThis, "WebSocket", NeverOpens);
}
