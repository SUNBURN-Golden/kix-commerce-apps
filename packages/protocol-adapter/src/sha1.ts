/**
 * RFC 3174 SHA-1. Used so the browser bundle can check the git blob ids that
 * the vendored SDK manifest pins without a Node-only crypto import.
 */
function rotl(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits));
}

export function sha1Hex(input: string | Uint8Array): string {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const bitLength = data.length * 8;
  const padded = new Uint8Array(((data.length + 9 + 63) >> 6) << 6);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      w[index] = view.getUint32(offset + index * 4);
    }
    /* eslint-disable @typescript-eslint/no-non-null-assertion --
       Indices are bounded by the SHA-1 message schedule (0..79); the
       array is sized to 80 and the loop invariants guarantee access. */
    for (let index = 16; index < 80; index += 1) {
      w[index] = rotl(w[index - 3]! ^ w[index - 8]! ^ w[index - 14]! ^ w[index - 16]!, 1);
    }
    /* eslint-enable @typescript-eslint/no-non-null-assertion */

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let index = 0; index < 80; index += 1) {
      let f: number;
      let k: number;
      if (index < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (index < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- index is bounded by the 80-word schedule loop.
      const temp = (rotl(a, 5) + f + e + k + w[index]!) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4].map((word) => word.toString(16).padStart(8, "0")).join("");
}

/** Git blob object id: sha1("blob <size>\\0" + bytes). */
export function gitBlobId(bytes: Uint8Array): string {
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const object = new Uint8Array(header.length + bytes.length);
  object.set(header);
  object.set(bytes, header.length);
  return sha1Hex(object);
}
