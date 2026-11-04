import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_GATE_JSON_DEPTH, parseGateJson, readGateResponseText } from "../src/gate-json.js";
import { enforceRemotePayloadGuards } from "../src/payload-guards.js";
import { ProtocolError } from "../src/types.js";

afterEach(() => vi.restoreAllMocks());

describe("finite JSON numbers", () => {
  for (const token of ["1e400", "-1e400"]) {
    it.each([token, `{"value":${token}}`, `[${token}]`, `{"value":[0,{"nested":${token}}]}`])(
      "rejects raw overflow at every placement: %s", (text) => {
        expect(() => parseGateJson(text)).toThrowError(new ProtocolError(
          "Integration gate returned a non-finite number.", "GATE_STATUS"));
      });
    for (const kind of ["object", "array", "mixed"] as const) {
      it(`${token} at ${kind} depth 32 gets the numeric error`, () => {
        expect(() => parseGateJson(nested(32, kind, token))).toThrow(/non-finite number/);
      });
      it(`${token} at ${kind} depth 33 fails before JSON.parse`, () => {
        const parser = vi.spyOn(JSON, "parse");
        expect(() => parseGateJson(nested(33, kind, token))).toThrow(/nested too deeply/);
        expect(parser).not.toHaveBeenCalled();
      });
    }
  }
  it.each(["1.7976931348623157e308", "-1e308", "1e-300", "1.25", "0", "-0", '"1e400"',
    '[0,-0,1.25,1e308,{"value":-1e-300,"text":"-1e400"}]'])("preserves finite values and strings: %s", (text) => {
    expect(parseGateJson(text)).toEqual(JSON.parse(text));
  });
  it.each(['{"__proto__":1e400}', '{"x":"\\ud800","value":-1e400}', '{"a":0,"a":1e400}'])(
    "checks numbers before the decoded key/string scan: %s", (text) => {
      expect(() => parseGateJson(text)).toThrow(/non-finite number/);
    });
  it("still rejects a duplicate key whose earlier overflow was overwritten by JSON.parse", () => {
    expect(() => parseGateJson('{"a":1e400,"a":0}')).toThrow(/ambiguous or unsafe JSON/);
  });
});

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

it("preserves null-body behavior", async () => {
  const signal = new AbortController().signal;
  expect(await readGateResponseText(new Response(null), signal)).toBe("");
});

it("strips a UTF-8 BOM while preserving explicitly encoded U+FFFD", async () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x22, 0xef, 0xbf, 0xbd, 0x22]);
  expect(await readGateResponseText(new Response(bytes), new AbortController().signal)).toBe('"\uFFFD"');
});

it("rejects malformed UTF-8 and releases the reader and abort listener after EOF", async () => {
  const abort = new AbortController();
  const add = vi.spyOn(abort.signal, "addEventListener");
  const remove = vi.spyOn(abort.signal, "removeEventListener");
  const response = new Response(new Uint8Array([0x22, 0xff, 0x22]));
  const error: unknown = await readGateResponseText(response, abort.signal).catch((error: unknown) => error);
  expect(error).toBeInstanceOf(ProtocolError);
  expect(error).toMatchObject({ message: "Integration gate returned invalid UTF-8.", code: "GATE_STATUS" });
  expect(response.body?.locked).toBe(false);
  expect(abort.signal.aborted).toBe(false);
  expect(remove.mock.calls[0]).toEqual(add.mock.calls[0].slice(0, 2));
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
