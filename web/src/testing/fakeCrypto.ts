import { concat, utf8 } from "../lib/bytes";

/**
 * A 32-byte tag of some parts, for tests ONLY: enough for a mock server to tell a right answer from a wrong one, and for the stand-in sealing
 * below to refuse another secret every time. It keeps four 32-bit lanes and mixes the high bits back down after every step.
 */
export function fakeDigest(...parts: Uint8Array[]): Uint8Array {
  const input = concat(...parts);
  const lane = new Uint32Array([0x9e3779b1, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f]);
  const mix = (l: number, v: number) => {
    let h = Math.imul((lane[l]! ^ v) >>> 0, 0x01000193 + 2 * l) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d) >>> 0;
    h ^= h >>> 12;
    lane[l] = h;
  };
  for (const b of input) for (let l = 0; l < 4; l++) mix(l, b + 1 + l * 257 + lane[(l + 1) % 4]!);
  for (let l = 0; l < 4; l++) mix(l, input.length + 7 * l);
  const out = new Uint8Array(32);
  for (let k = 0; k < 32; k++) {
    const l = k % 4;
    mix(l, lane[(l + 3) % 4]! + k);
    out[k] = (lane[l]! >>> ((k >> 2) % 4) * 8) & 0xff;
  }
  return out;
}

export function fakeSignature(signing: Uint8Array, context: string, message: Uint8Array): Uint8Array {
  const half = fakeDigest(signing, utf8(context), message);
  return concat(half, fakeDigest(half, signing));
}

export function fakeVerify(signing: Uint8Array, context: string, message: Uint8Array, signature: Uint8Array): boolean {
  const want = fakeSignature(signing, context, message);
  return signature.length === 64 && want.every((b, i) => b === signature[i]);
}
