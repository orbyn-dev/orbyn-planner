// DEVELOPMENT ONLY. Draws the frames a pull request says it built, ours only, in Light, Dark and Dim, and writes the comment.
//
//   node tools/pr-preview/render.mjs --body <file> --out <dir> [--url <prefix>] [--run-url <url>] [--sha <sha>]
//
// Reads the "Frames built" line of the description in <file>, runs the match kit's seeded, dev-only render (`scripts/match.mjs --ours-only`,
// which never reads the private design page) and writes <out>/images/<frame>/<theme>.png, <out>/manifest.json and <out>/comment.md.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { askForFrames, buildComment } from "./comment.mjs";
import { framesBuilt, selectFrames } from "./frames.mjs";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const flags = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const out = resolve(String(flags.out));
const urlPrefix = String(flags.url ?? ".");
const runUrl = String(flags["run-url"] ?? "");
const sha = String(flags.sha ?? "0000000");
const THEMES = ["light", "dark", "dim"];
const known = JSON.parse(readFileSync(join(web, "tools/match/frames.json"), "utf8"));
const body = existsSync(String(flags.body)) ? readFileSync(String(flags.body), "utf8") : "";

mkdirSync(join(out, "images"), { recursive: true });
const built = framesBuilt(body);
const done = (comment, manifest) => {
  writeFileSync(join(out, "comment.md"), comment);
  writeFileSync(join(out, "manifest.json"), JSON.stringify({ sha, ...manifest }, null, 2));
};

if (built.line === "missing" || built.line === "empty") {
  done(askForFrames(built.line), { asked: true, units: [] });
  console.log("no Frames built line: asking for one");
} else if (built.line === "none") {
  done("", { none: true, units: [] });
  console.log("Frames built: none");
} else {
  const { use, unknown, over } = selectFrames(built.ids, known);
  const units = [];
  const failed = [];
  let error = null;
  if (use.length > 0) {
    const run = spawnSync(process.execPath, [join(web, "scripts/match.mjs"), ...use, "--ours-only", "--theme", "all", "--out", join(out, "raw")], { cwd: web, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ORBYN_DESIGNS_DIR: "", ORBYN_DESIGN_FILE: "" } });
    process.stdout.write(run.stdout ?? "");
    process.stderr.write(run.stderr ?? "");
    for (const id of use) {
      const images = {};
      for (const theme of THEMES) {
        const file = join(out, "raw", `${id.replace("@", "-")}-${theme}-ours.png`);
        if (!existsSync(file)) continue;
        const rel = `${id.replace("@", "-")}/${theme}.png`;
        mkdirSync(dirname(join(out, "images", rel)), { recursive: true });
        copyFileSync(file, join(out, "images", rel));
        images[theme] = rel;
      }
      if (Object.keys(images).length === 0) failed.push(id);
      else units.push({ id, images });
    }
    if (units.length === 0) error = run.status === 0 ? "no image was written" : `the render exited with ${run.status}`;
  } else if (unknown.length === 0) {
    error = "no frame was named";
  }
  done(buildComment({ units, failed, unknown, over, version: built.version, url: (rel) => `${urlPrefix.replace(/\/$/, "")}/images/${rel}?raw=true`, runUrl, sha, error }), { units, failed, unknown, over, error });
  console.log(`done: ${units.length} frames drawn, ${failed.length} failed`);
}
