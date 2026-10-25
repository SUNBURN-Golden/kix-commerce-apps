import { ProtocolError } from "./types.js";

/** Standard JSON syntax, with no ambiguous keys or lone Unicode surrogates.
 * JSON.parse creates own data properties; remote objects are never merged.
 */
export function parseGateJson(text: string): unknown {
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
