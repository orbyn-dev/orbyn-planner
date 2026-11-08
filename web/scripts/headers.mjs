// Writes the nginx security headers for one build: node scripts/headers.mjs <index.html> <out>
//
// The policy allows the page's own files, the engine the build was made for
// (VITE_ENGINE_URL) and nothing else. index.html holds one inline script, which sets the theme
// before the first paint; it is allowed by its hash, so no inline script can be added. The
// engine's WebAssembly module needs 'wasm-unsafe-eval', which does not allow eval().
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const [indexPath, outPath] = process.argv.slice(2);
if (!indexPath || !outPath) throw new Error("usage: node scripts/headers.mjs <index.html> <out>");

const html = readFileSync(indexPath, "utf8");
const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (inline.length !== 1) throw new Error(`expected one inline script in ${indexPath}, found ${inline.length}`);
const hash = createHash("sha256").update(inline[0]).digest("base64");

const connect = ["'self'"];
const engine = process.env.VITE_ENGINE_URL?.trim();
if (engine) {
  const url = new URL(engine);
  if (url.protocol !== "https:") throw new Error("VITE_ENGINE_URL must be an https:// address for a deployed build");
  // The live sync is a WebSocket on the same host: wss://<engine>/v1/sync.
  connect.push(url.origin, url.origin.replace(/^https:/, "wss:"));
}

const csp = [
  "default-src 'self'",
  `script-src 'self' 'sha256-${hash}' 'wasm-unsafe-eval'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src ${connect.join(" ")}`,
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-src 'none'",
].join("; ");

const headers = `# Sent on every response. Written by scripts/headers.mjs for this build.
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), interest-cohort=()" always;
add_header Content-Security-Policy "${csp}" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
`;
writeFileSync(outPath, headers);
