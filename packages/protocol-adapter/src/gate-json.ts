import { ProtocolError } from "./types.js";

// App-local resource guards, not protocol contract limits.
export const MAX_GATE_RESPONSE_BYTES = 1_048_576;
export const MAX_GATE_JSON_DEPTH = 32;

/** Count actual stream bytes; Content-Length is neither trusted nor allocated. */
export async function readGateResponseText(response: Response, signal: AbortSignal): Promise<string> {
  const reader = response.body?.getReader();
  // Cancellation must not delay the primary failure, even if the source hangs
  // or rejects cancellation. Never abort the exchange controller on overflow.
  const cancel = () => { void reader?.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    if (signal.aborted) {
      cancel();
      throw signal.reason;
    }
    if (!reader) return "";
    let buffer = new Uint8Array(0);
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw signal.reason;
      if (done) break; // Even exactly the limit requires EOF before parsing.
      const nextLength = length + value.byteLength;
      if (nextLength > MAX_GATE_RESPONSE_BYTES) {
        cancel();
        throw new ProtocolError("Integration gate response exceeds the client byte limit.", "GATE_STATUS");
      }
      if (nextLength > buffer.byteLength) {
        const grown = new Uint8Array(Math.min(MAX_GATE_RESPONSE_BYTES,
          Math.max(4096, buffer.byteLength * 2, nextLength)));
        grown.set(buffer.subarray(0, length));
        buffer = grown;
      }
      buffer.set(value, length);
      length = nextLength;
    }
    // Decode once: split UTF-8 code points and BOM/replacement behavior match text().
    return new TextDecoder().decode(buffer.subarray(0, length));
  } finally {
    signal.removeEventListener("abort", cancel);
    reader?.releaseLock();
  }
}

/** Same set as `\s`: ASCII whitespace by comparison, the rest by regex. */
function isJsonSpace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r" || char === "\v" || char === "\f"
    || (char > "\u007f" && /\s/.test(char));
}

function isScalarBreak(char: string): boolean {
  switch (char) {
    case "{": case "}": case "[": case "]": case ":": case ",": case '"':
      return true;
  }
  return isJsonSpace(char);
}

/** Lexical depth scan before ANY JSON.parse. Syntax remains JSON.parse's job.
 * Root value is depth 0; keys do not count, but scalar leaves and empty
 * containers do. State is bounded by the depth ceiling, independent of width.
 */
function preflightDepth(text: string): void {
  const stack: { object: boolean; key: boolean }[] = [];
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const parent = stack.at(-1);
    if (char === "}" || char === "]") { stack.pop(); continue; }
    if (char === ":") { if (parent) parent.key = false; continue; }
    if (char === ",") { if (parent?.object) parent.key = true; continue; }
    if (isJsonSpace(char)) continue;
    const isKey = char === '"' && parent?.object && parent.key;
    if (!isKey && stack.length > MAX_GATE_JSON_DEPTH) {
      throw new ProtocolError("Remote payload is nested too deeply.", "GATE_STATUS");
    }
    if (char === "{" || char === "[") {
      stack.push({ object: char === "{", key: char === "{" });
    } else if (char === '"') {
      while (++index < text.length) {
        if (text[index] === "\\") index++;
        else if (text[index] === '"') break;
      }
    } else {
      // Skip a scalar token without allocating it or interpreting its syntax.
      while (index + 1 < text.length && !isScalarBreak(text[index + 1])) index++;
    }
  }
}

/** Standard JSON syntax, with no ambiguous keys or lone Unicode surrogates.
 * JSON.parse creates own data properties; remote objects are never merged.
 */
export function parseGateJson(text: string): unknown {
  preflightDepth(text);
  const parsed: unknown = JSON.parse(text);
  // Syntax is already checked. Numbers, literals and commas need no preflight;
  // a string followed by a colon is an object key. Keep escapes intact.
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|[{}[\]:]/g) ?? [];
  const stack: (Set<string> | null)[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === "{" || token === "[") {
      stack.push(token === "{" ? new Set() : null);
    } else if (token === "}" || token === "]") stack.pop();
    else if (token.startsWith('"')) {
      const value = JSON.parse(token) as string;
      const keys = tokens[index + 1] === ":" ? stack.at(-1) : null;
      // Unicode mode matches unpaired surrogate code points, not valid pairs.
      if (/[\uD800-\uDFFF]/u.test(value) || (keys &&
        (keys.has(value) || value === "__proto__" || value === "constructor" || value === "prototype"))) {
        throw new ProtocolError("Integration gate returned ambiguous or unsafe JSON.", "GATE_STATUS");
      }
      keys?.add(value);
    }
  }
  return parsed;
}
