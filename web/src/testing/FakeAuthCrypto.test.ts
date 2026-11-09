import { describe, expect, it } from "vitest";
import { fakeDigest, fakeOpen, fakeSeal } from "./FakeAuthCrypto";

/** A fixed pseudo-random stream, so the loops below read the same every run. */
function stream(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
}

// The stand-in sealing must refuse another secret every time; the engine host test relies on that (a wrong secret reading as a snapshot once
// in a thousand runs failed it as "invalid_json" instead of "open_failed").
describe("the stand-in sealing used by tests", () => {
  it("never opens with another secret, over many different blobs", () => {
    const next = stream(1);
    const wrap = new Uint8Array(32).fill(7);
    let opened = 0;
    for (let i = 0; i < 4_000; i++) {
      const other = Uint8Array.from({ length: 32 }, () => next() >>> 24);
      const plain = Uint8Array.from({ length: 24 + (next() % 100) }, () => next() >>> 24);
      const sealed = fakeSeal(wrap, "snapshot", plain);
      try {
        fakeOpen(other, "snapshot", sealed);
        opened += 1;
      } catch (e) {
        expect((e as Error).message).toMatch(/^open_failed/);
      }
    }
    expect(opened).toBe(0);
  });

  it("opens with the right secret, and refuses a changed byte or another purpose", () => {
    const wrap = new Uint8Array(32).fill(7);
    const plain = new TextEncoder().encode("hello");
    const sealed = fakeSeal(wrap, "snapshot", plain);
    expect(Array.from(fakeOpen(wrap, "snapshot", sealed))).toEqual(Array.from(plain));
    const changed = sealed.slice();
    changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
    expect(() => fakeOpen(wrap, "snapshot", changed)).toThrow(/open_failed/);
    expect(() => fakeOpen(wrap, "keys", sealed)).toThrow(/open_failed/);
  });

  it("its digest depends on every byte, and its 8-byte tags do not repeat over 10 000 inputs", () => {
    const next = stream(2);
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const input = Uint8Array.from({ length: 20 }, () => next() >>> 24);
      seen.add(Array.from(fakeDigest(input).slice(0, 8)).join(","));
    }
    expect(seen.size).toBe(10_000);
  });
});
