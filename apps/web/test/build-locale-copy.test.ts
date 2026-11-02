import { describe, expect, it } from "vitest";
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compactLocaleCopy, LOCALE_ROWS_HELPER } from "../build-locale-copy";

function evaluate(source: string) {
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("exports", "require", output)(exports, (id: string) => id.includes("kix-locale-rows")
    ? evaluate(LOCALE_ROWS_HELPER) : { boundary: "UNKNOWN / NOT_BOUND / STALE" });
  return exports;
}

describe("build-only locale dictionary templates", () => {
  it("preserves both evaluated catalogues, ordering, shared imports, tokens and placeholders exactly", () => {
    const source = `import { boundary } from "./shared-copy";
      export const messages = { en: { title: "Audience {count}", note: boundary, empty: "" },
      ko: { title: "대상 {count}", note: boundary, empty: "" } } as const;`;
    const compact = compactLocaleCopy(source, "/fixture/src/i18n/messages/m05.ts");
    expect(compact).not.toBeNull();
    expect(evaluate(compact!).messages).toEqual(evaluate(source).messages);
    expect(compact?.match(/"title"/g)).toHaveLength(1);
    expect(compact?.match(/boundary/g)).toHaveLength(2);
  });
  it("preserves every supported repository catalogue exactly", () => {
    const folder = fileURLToPath(new URL("../src/i18n/messages/", import.meta.url));
    const cache = new Map<string, Record<string, unknown>>();
    function load(source: string, file: string) {
      const exports: Record<string, unknown> = {};
      const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
      new Function("exports", "require", output)(exports, (id: string) => {
        if (id.includes("kix-locale-rows")) return evaluate(LOCALE_ROWS_HELPER);
        const dependency = path.resolve(path.dirname(file), id) + ".ts";
        if (!cache.has(dependency)) cache.set(dependency, load(readFileSync(dependency, "utf8"), dependency));
        return cache.get(dependency);
      });
      return exports;
    }
    let checked = 0;
    for (const name of readdirSync(folder)) {
      const file = path.join(folder, name);
      const source = readFileSync(file, "utf8");
      const compact = compactLocaleCopy(source, file);
      if (!compact) continue;
      const original = load(source, file).messages as { en: Record<string, string>; ko: Record<string, string> };
      const actual = load(compact, file).messages as typeof original;
      expect(actual, name).toEqual(original);
      for (const locale of ["en", "ko"] as const) expect(Object.keys(actual[locale]), name).toEqual(Object.keys(original[locale]));
      checked += 1;
    }
    expect(checked).toBeGreaterThan(100);
  });
  it.each([
    'export const messages = makeMessages();',
    'export const messages = { en: {}, ko: {} }; export const other = 1;',
    'export const messages = { en: {}, fr: {} };',
    'export const messages = { en: catalogue, ko: {} };',
    'export const messages = { en: {a: compute()}, ko: {a: compute()} };',
    'export const messages = { en: {a:"a", b:"b"}, ko:{b:"b", a:"a"} };',
    'export const messages = { en: {__proto__: "x"}, ko: {__proto__: "x"} };',
  ])("leaves unsupported source shapes unchanged: %s", (source) => {
    expect(compactLocaleCopy(source, "/fixture/messages.ts")).toBeNull();
  });
});
