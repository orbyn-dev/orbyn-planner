import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const FEATURE_ROOT = "features";
const TEST_NAME = /\.(test|spec)\.[cm]?[jt]sx?$/;

// One-way imports: a layer may import from the layers listed here, never from one above it.
const ALLOWED = {
  app: ["app", "features", "state", "data", "core", "ui", "lib", "styles", "generated"],
  features: ["features", "state", "data", "core", "ui", "lib", "styles", "generated"],
  state: ["state", "data", "core", "lib", "styles", "generated"],
  data: ["data", "core", "lib", "generated"],
  core: ["core", "lib", "generated"],
  ui: ["ui", "core", "lib", "styles", "generated"],
  lib: ["lib", "styles"],
  styles: ["styles"],
  generated: ["generated"],
};

const sourceFiles = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) sourceFiles.push(path);
  }
}
walk(srcRoot);

const relativePath = (path) => relative(srcRoot, path).split(sep).join("/");
const testOnly = (path) => TEST_NAME.test(path) || relativePath(path).startsWith("testing/") || relativePath(path).startsWith("e2e/");

function layerOf(path) {
  const rel = relativePath(path);
  if (rel === "main.tsx") return "app";
  const head = rel.split("/")[0];
  return head in ALLOWED ? head : "unknown";
}

function resolveImport(importer, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(importer), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const importPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']/g;
const edges = [];
const errors = [];

for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(importPattern)) {
    const target = resolveImport(file, match[1]);
    if (target) edges.push({ from: file, to: target });
  }
}

const productionEdges = edges.filter(({ from, to }) => !testOnly(from) && !testOnly(to));
const graph = new Map(sourceFiles.filter((file) => !testOnly(file)).map((file) => [file, []]));
for (const { from, to } of productionEdges) {
  if (graph.has(from) && graph.has(to)) graph.get(from).push(to);
}

// Feature front doors: every feature has an index, and another feature is only reached through it.
const featureDirs = new Map();
for (const file of sourceFiles) {
  const rel = relativePath(file);
  const [head, feature] = rel.split("/");
  if (head !== FEATURE_ROOT || !feature) continue;
  if (!featureDirs.has(feature)) featureDirs.set(feature, []);
  featureDirs.get(feature).push(file);
}
for (const [feature, files] of featureDirs) {
  const index = join(srcRoot, FEATURE_ROOT, feature, "index.ts");
  if (files.some((file) => relativePath(file) !== `${FEATURE_ROOT}/${feature}/index.ts`) && !existsSync(index)) {
    errors.push(`${FEATURE_ROOT}/${feature}/index.ts is missing`);
  }
}
for (const { from, to } of edges) {
  const fromRel = relativePath(from);
  const toRel = relativePath(to);
  const [fromHead, fromFeature] = fromRel.split("/");
  const [toHead, toFeature] = toRel.split("/");
  if (fromHead !== FEATURE_ROOT || toHead !== FEATURE_ROOT || fromFeature === toFeature) continue;
  const expected = `${FEATURE_ROOT}/${toFeature}/index.ts`;
  if (toRel !== expected) {
    errors.push(`${fromRel} imports ${toRel}; use ${expected}`);
  }
}

// Layering. Test-only code, testing/, and e2e/ may use anything.
for (const { from, to } of productionEdges) {
  const fromLayer = layerOf(from);
  const toLayer = layerOf(to);
  if (fromLayer === "unknown" || toLayer === "unknown") {
    errors.push(`${relativePath(from)} imports ${relativePath(to)} from an unclassified layer`);
    continue;
  }
  if (!ALLOWED[fromLayer].includes(toLayer)) {
    errors.push(`${relativePath(from)} imports ${relativePath(to)} (${fromLayer} -> ${toLayer})`);
  }
}

// Cycles in the production graph, including barrels.
const indices = new Map();
const low = new Map();
const stack = [];
const onStack = new Set();
const components = [];
let nextIndex = 0;
function connect(node) {
  indices.set(node, nextIndex);
  low.set(node, nextIndex);
  nextIndex += 1;
  stack.push(node);
  onStack.add(node);
  for (const next of graph.get(node) ?? []) {
    if (!indices.has(next)) {
      connect(next);
      low.set(node, Math.min(low.get(node), low.get(next)));
    } else if (onStack.has(next)) {
      low.set(node, Math.min(low.get(node), indices.get(next)));
    }
  }
  if (low.get(node) === indices.get(node)) {
    const component = [];
    let popped;
    do {
      popped = stack.pop();
      onStack.delete(popped);
      component.push(popped);
    } while (popped !== node);
    components.push(component);
  }
}
for (const node of graph.keys()) if (!indices.has(node)) connect(node);

const cycles = components.filter((component) => component.length > 1 || graph.get(component[0]).includes(component[0]));
for (const component of cycles) {
  errors.push(`cycle: ${component.map(relativePath).sort().join(" -> ")}`);
}

const shown = errors.slice(0, 50);
for (const error of shown) console.error(`- ${error}`);
if (errors.length > shown.length) console.error(`- ... and ${errors.length - shown.length} more`);
console.log(`Import boundaries: ${sourceFiles.length} files, ${productionEdges.length} production edges, ${cycles.length} cycles, ${errors.length} errors`);
if (errors.length > 0) process.exitCode = 1;
