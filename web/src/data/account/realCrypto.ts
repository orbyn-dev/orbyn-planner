import { type AuthCrypto } from "../../core/account/authCrypto";
import { loadWasmAuthCrypto, type OrbynWasmModule } from "./WasmAuthCrypto";

/**
 * The engine's real module, loaded only when it is needed. The import is dynamic, so Vite puts the
 * JavaScript glue and the `.wasm` file in chunks of their own that a page without accounts never
 * fetches. wasm-bindgen's `init()` then fetches the `.wasm` next to the glue (`new URL(..., import.meta.url)`).
 * The assignment to `OrbynWasmModule` makes the compiler check the real module against the names and
 * shapes the adapter uses.
 */
export function loadRealAuthCrypto(): Promise<AuthCrypto> {
  return loadWasmAuthCrypto(async () => {
    const module: OrbynWasmModule = await import("../../generated/wasm/orbyn_wasm");
    return module;
  });
}
