import { describe, expect, it } from "vitest";
// @ts-expect-error plain modules shared with the render script
import { MARKER, askForFrames, buildComment } from "./comment.mjs";
// @ts-expect-error plain modules shared with the render script
import { MAX_FRAMES, framesBuilt, selectFrames } from "./frames.mjs";

type Built = { line: "missing" | "empty" | "none" | "ids"; ids: string[]; version: string | null };
const built = framesBuilt as (body: string) => Built;
const pick = selectFrames as (ids: string[], known: Record<string, unknown>, max?: number) => { use: string[]; unknown: string[]; over: string[] };
const comment = buildComment as (p: Record<string, unknown>) => string;
const ask = askForFrames as (reason: string) => string;

describe("the Frames built line", () => {
  it("reads the frame ids and the design version", () => {
    expect(built("## Summary\n\n- x\n\nFrames built: p-today, p-today-empty @ v47\n\n## Testing")).toEqual({ line: "ids", ids: ["p-today", "p-today-empty"], version: "v47" });
  });

  it("keeps an id that has an @ of its own, and a list without a version", () => {
    expect(built("Frames built: p-phone-week@1 p-phone-week")).toEqual({ line: "ids", ids: ["p-phone-week@1", "p-phone-week"], version: null });
    expect(built("- Frames built: `today`, `today`  @  v50")).toEqual({ line: "ids", ids: ["today"], version: "v50" });
  });

  it("says none when the pull request draws nothing", () => {
    expect(built("Frames built: none")).toMatchObject({ line: "none", ids: [] });
    expect(built("Frames built: n/a @ v47")).toMatchObject({ line: "none" });
  });

  it("asks when the line is missing or empty, and the template's own example in a comment does not count", () => {
    expect(built("## Summary\n- x").line).toBe("missing");
    expect(built(null as unknown as string).line).toBe("missing");
    expect(built("Frames built:").line).toBe("empty");
    expect(built("<!-- Frames built: p-today @ v47 -->\n\nFrames built:\n").line).toBe("empty");
  });
});

describe("which frames are drawn", () => {
  const known = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, {}]));

  it("draws the frames the kit knows, names the ones it does not, and stops at 12", () => {
    const ids = [...Array.from({ length: 14 }, (_, i) => `f${i}`), "nope"];
    const r = pick(ids, known);
    expect(MAX_FRAMES).toBe(12);
    expect(r.use).toHaveLength(12);
    expect(r.over).toEqual(["f12", "f13"]);
    expect(r.unknown).toEqual(["nope"]);
  });
});

describe("the comment", () => {
  const url = (rel: string) => `https://x/${rel}?raw=true`;
  const base = { failed: [], unknown: [], over: [], version: "v47", url, runUrl: "https://run", sha: "abcdef1234", error: null };

  it("shows Light first and folds Dark and Dim, with the version and the run link", () => {
    const text = comment({ ...base, units: [{ id: "p-today", images: { light: "p-today/light.png", dark: "p-today/dark.png", dim: "p-today/dim.png" } }] });
    expect(text.startsWith(MARKER)).toBe(true);
    expect(text).toContain("Frames built @ v47: 1 drawn from the seeded dev-only planner (fake data, no account), commit `abcdef1`");
    expect(text.indexOf("p-today/light.png?raw=true")).toBeLessThan(text.indexOf("<details>"));
    expect(text.indexOf("<details>")).toBeLessThan(text.indexOf("p-today/dark.png?raw=true"));
    expect(text).toContain("p-today/dim.png?raw=true");
    expect(text).toContain("[this workflow run](https://run)");
  });

  it("says so when a frame could not be drawn, an id is unknown, or the cap was reached", () => {
    const text = comment({ ...base, units: [], failed: ["a"], unknown: ["b"], over: ["c"] });
    expect(text).toContain("Could not draw: `a`");
    expect(text).toContain("Not frames of the match kit: `b`");
    expect(text).toContain("Over the limit of 12, not drawn: `c`");
  });

  it("says so when nothing could be drawn, and never blocks", () => {
    const text = comment({ ...base, units: [], error: "the render exited with 1" });
    expect(text).toContain("The preview could not be built for `abcdef1`: the render exited with 1");
    expect(text).toContain("Nothing is blocked.");
  });

  it("asks for the line without blocking anything", () => {
    expect(ask("missing")).toContain("has no **Frames built** line");
    expect(ask("empty")).toContain("The **Frames built** line is empty");
    expect(ask("missing")).toContain("nothing is blocked");
    expect(ask("missing").startsWith(MARKER)).toBe(true);
  });
});

describe("the workflows", () => {
  const nodeFs = "node:fs";
  const read = async (name: string) => {
    const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
    return fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/../.github/workflows/${name}`, "utf8");
  };

  it("run for pull requests of this repository only, never from a fork, and take no secret", async () => {
    for (const name of ["ui-preview.yml", "ui-preview-cleanup.yml"]) {
      const text = await read(name);
      expect(text).toContain("github.event.pull_request.head.repo.full_name == github.repository");
      expect(text).not.toContain("pull_request_target");
      expect(text).not.toMatch(/secrets\./);
    }
  });

  it("pin every action to a commit", async () => {
    const text = await read("ui-preview.yml");
    const uses = [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1]!);
    expect(uses.length).toBeGreaterThanOrEqual(3);
    for (const u of uses) expect(u).toMatch(/@[0-9a-f]{40}$/);
  });

  it("draw our own app only: nothing reads or publishes the private designs", async () => {
    const text = await read("ui-preview.yml");
    expect(text).not.toMatch(/orbyn-designs|ORBYN_DESIGNS_DIR|ORBYN_DESIGN_FILE|planner-designs/);
    expect(text).toContain("tools/pr-preview/render.mjs");
  });

  it("is informational: a failure comments, and the job is not a required check by name", async () => {
    const text = await read("ui-preview.yml");
    expect(text).toContain("Say so when the preview failed");
    expect(text).toContain("Nothing is blocked");
    expect(text).toContain("if: github.event.pull_request.head.repo.full_name == github.repository");
  });
});
