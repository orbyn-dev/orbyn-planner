import { describe, expect, it } from "vitest";
import { signedOutAccount } from "./account";

// The signed-out page's pretend engine and the controls a frame's steps get (dev only; see account.ts).
describe("the signed-out pretend account", () => {
  it("gives a frame's steps the mock engine, a set of held paths and an offline switch", () => {
    const { controls } = signedOutAccount();
    expect(typeof controls.engine.requireInvites).toBe("function");
    expect(typeof controls.engine.refuseNext).toBe("function");
    expect(controls.hold.size).toBe(0);
    expect(controls.offline.value).toBe(false);
  });

  it("an invite code made by a step is the only one that works, and another is refused", async () => {
    const { controls } = signedOutAccount();
    controls.engine.requireInvites("K7QM-2XWH-9QXA-LC2D");
    const check = (invite: string) => controls.engine.fetch("http://engine.test/v1/invites/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ invite }) });
    expect((await check("k7qm2xwh9qxalc2d")).status).toBe(204);
    expect((await check("AAAA-BBBB-CCCC-DDDD")).status).toBe(400);
  });
});
