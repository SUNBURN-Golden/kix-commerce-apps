import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_GATE_JSON_DEPTH, parseGateJson, readGateResponseText } from "../src/gate-json.js";
import { enforceRemotePayloadGuards } from "../src/payload-guards.js";
import { ProtocolError } from "../src/types.js";

afterEach(() => vi.restoreAllMocks());

function nested(depth: number, kind: "object" | "array" | "mixed", leaf: string): string {
  let text = leaf;
  for (let index = 0; index < depth; index++) {
    text = kind === "object" || (kind === "mixed" && index % 2 === 0) ? `{"value":${text}}` : `[${text}]`;
  }
  return text;
}

describe("JSON value depth before parsing", () => {
  it("keeps the existing maximum value depth of 32", () => expect(MAX_GATE_JSON_DEPTH).toBe(32));
  for (const kind of ["object", "array", "mixed"] as const) {
    for (const leaf of ["{}", "[]", "null", "true", "42", '"leaf"']) {
      it(`${kind} with ${leaf} at depth 32 agrees with payload guards`, () => {
        const text = nested(32, kind, leaf);
        const parsed = parseGateJson(text);
        expect(parsed).toEqual(JSON.parse(text));
        expect(() => enforceRemotePayloadGuards(parsed)).not.toThrow();
      });
      it(`${kind} with ${leaf} at depth 33 fails before any JSON.parse`, () => {
        const text = nested(33, kind, leaf);
        const parsed: unknown = JSON.parse(text);
        expect(() => enforceRemotePayloadGuards(parsed)).toThrow(/nested too deeply/);
        const parser = vi.spyOn(JSON, "parse");
        expect(() => parseGateJson(text)).toThrow(ProtocolError);
        expect(() => parseGateJson(text)).toThrow(/nested too deeply/);
        expect(parser).not.toHaveBeenCalled();
      });
    }
  }

  it("does not count keys or structure inside escaped strings", () => {
    const strings = ['{[}]'.repeat(100), 'quote"slash\\', '\\"[{', '한글😀'];
    const leaf = JSON.stringify({ [strings[0]]: strings.join(" ") });
    const text = nested(31, "mixed", leaf);
    expect(parseGateJson(text)).toEqual(JSON.parse(text));
    expect(() => enforceRemotePayloadGuards(parseGateJson(text))).not.toThrow();
    expect(() => parseGateJson(nested(32, "object", leaf))).toThrow(/nested too deeply/);
  });

  it("scans siblings independently and permits empty containers at depth 32", () => {
    const text = `[${nested(31, "object", "{}")},${nested(31, "array", '"end"')},0]`;
    expect(parseGateJson(text)).toEqual(JSON.parse(text));
    expect(() => parseGateJson(`[${nested(32, "array", "[]")}]`)).toThrow(/nested too deeply/);
  });

  it.each(["", "{", "[1,]", '{"x" 1}', '"unterminated', "true false", "1:"])("leaves syntax authority with JSON.parse: %s", (text) => {
    expect(() => parseGateJson(text)).toThrow(SyntaxError);
  });

  it.each([
    '{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"__proto__":{}}',
    '{"constructor":0}', '{"nested":[{"prototype":false}]}',
    '"\\ud800"', '"\\udc00"', '{"\\ud800":0}',
  ])("retains unsafe-JSON rejection: %s", (text) => {
    expect(() => parseGateJson(text)).toThrow(ProtocolError);
  });
});

it("preserves null-body, BOM and malformed UTF-8 replacement behavior", async () => {
  const signal = new AbortController().signal;
  expect(await readGateResponseText(new Response(null), signal)).toBe("");
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x22, 0xff, 0x22]);
  expect(await readGateResponseText(new Response(bytes), signal)).toBe(await new Response(bytes).text());
});

it("cancels an already-aborted response without pulling or keeping listeners/locks", async () => {
  const abort = new AbortController();
  abort.abort(new Error("expired"));
  const pull = vi.fn();
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 });
  const add = vi.spyOn(abort.signal, "addEventListener");
  const remove = vi.spyOn(abort.signal, "removeEventListener");
  await expect(readGateResponseText(new Response(body), abort.signal)).rejects.toThrow("expired");
  expect(pull).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
  expect(remove.mock.calls[0]).toEqual(add.mock.calls[0].slice(0, 2));
});
