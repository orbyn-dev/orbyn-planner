import { wasmAuthCrypto } from "../data/account/WasmAuthCrypto";
import type { AuthCrypto } from "../core/account/authCrypto";
import * as wasm from "../generated/wasm/orbyn_wasm";
import wasmBytes from "../generated/wasm/orbyn_wasm_bg.wasm?inline";

let loaded: AuthCrypto | null = null;

/**
 * The engine's real module in a Node test: the `.wasm` arrives as a data: URL (Node has no fetch for
 * files), so its bytes are decoded and handed to the synchronous initialiser. Tests only.
 */
export function realAuthCrypto(): AuthCrypto {
  if (!loaded) {
    wasm.initSync({ module: Uint8Array.from(atob(wasmBytes.slice(wasmBytes.indexOf(",") + 1)), (c) => c.charCodeAt(0)) });
    loaded = wasmAuthCrypto(wasm);
  }
  return loaded;
}
