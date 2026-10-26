import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(web, "../..");

function staticGraph(entry: string) {
  const files = new Set<string>();
  const specifiers = new Set<string>();
  function visit(file: string) {
    if (files.has(file)) return;
    files.add(file);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
      if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      if (ts.isImportDeclaration(node) && node.importClause) {
        if (node.importClause.isTypeOnly) continue;
        const bindings = node.importClause.namedBindings;
        if (!node.importClause.name && bindings && ts.isNamedImports(bindings) && bindings.elements.every((el) => el.isTypeOnly)) continue;
      }
      if (ts.isExportDeclaration(node) && (node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.every((el) => el.isTypeOnly)))) continue;
      const spec = node.moduleSpecifier.text;
      specifiers.add(spec);
      const base = spec === "@kix/protocol-adapter" ? path.join(root, "packages/protocol-adapter/src/index")
        : spec.startsWith(".") ? path.resolve(path.dirname(file), spec.replace(/\.js$/, "")) : null;
      if (!base) continue;
      const resolved = [base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx"].find(existsSync);
      if (resolved) visit(resolved);
    }
  }
  visit(entry);
  return { files, specifiers };
}

describe("stub startup boundary", () => {
  it("keeps static main and shell imports clear of the adapter barrel and verification runtime", () => {
    const graph = staticGraph(path.join(web, "src/main.tsx"));
    expect(graph.files.size).toBeGreaterThan(30);
    const banned = ["index", "sdk-pin", "local-call", "http-adapter", "http-entry", "openapi-contract-pin", "integration-gate-pin", "sdk-consumption-tuple"];
    for (const name of banned) expect([...graph.files]).not.toContain(path.join(root, `packages/protocol-adapter/src/${name}.ts`));
    for (const spec of graph.specifiers) expect(spec).not.toMatch(/\?raw|#kix-sdk-0/);
    // Startup protocol reads must happen inside functions, after the readiness gate.
    for (const file of graph.files) {
      if (file.endsWith("/protocol.ts")) continue;
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      function inspect(node: ts.Node) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isFunctionLike(node)) return;
        if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
          expect(ts.isIdentifier(node.expression) && node.expression.text === "protocol", path.relative(root, file)).toBe(false);
        }
        ts.forEachChild(node, inspect);
      }
      ts.forEachChild(source, inspect);
    }
  });

  it.skipIf(!existsSync(path.join(web, "dist/index.html")))("keeps every initial script and preload free of raw pin bytes and meets the tighter node targets", () => {
    const dist = path.join(web, "dist");
    const html = readFileSync(path.join(dist, "index.html"), "utf8");
    const initial = new Set<string>();
    for (const tag of html.match(/<(?:script|link)\b[^>]*>/g) ?? []) {
      if (!tag.startsWith("<script") && !/rel="modulepreload"/.test(tag)) continue;
      const ref = /(?:src|href)="\/?([^"]+\.js)"/.exec(tag)?.[1];
      if (ref) initial.add(ref);
    }
    expect(initial.size).toBeGreaterThan(0);
    const scripts = readdirSync(path.join(dist, "assets")).filter((name) => name.endsWith(".js"));
    const text = (ref: string) => readFileSync(path.join(dist, ref), "utf8");
    const sentinels = [
      ["kix-sdk-0/compat/verify_compat.mjs", "Minimum offline consumer/producer verifier for manifest-v1."],
      ["kix-sdk-0/generate/generate_client.mjs", "Deterministic generator for sdk/generated/catalogue.ts."],
      ["kix-protocol.contract-only.openapi.json", "KIX protocol local-call catalogue (contract-only)"],
    ];
    for (const [file, marker] of sentinels) {
      const raw = readFileSync(path.join(root, "packages/protocol-adapter/vendor", file!), "utf8");
      const offset = raw.indexOf(marker!);
      expect(offset).toBeGreaterThanOrEqual(0);
      const sentinel = raw.slice(offset, offset + marker!.length);
      for (const ref of initial) expect(text(ref)).not.toContain(sentinel);
      expect(scripts.some((name) => !initial.has("assets/" + name) && text("assets/" + name).includes(sentinel))).toBe(true);
    }
    const gzip = (ref: string) => gzipSync(readFileSync(path.join(dist, ref)), { level: 9 }).length;
    expect([...initial].reduce((sum, ref) => sum + gzip(ref), 0)).toBeLessThanOrEqual(282000);
    const emitted = readdirSync(path.join(dist, "assets")).filter((name) => /\.(js|css)$/.test(name));
    expect(emitted.reduce((sum, name) => sum + gzip("assets/" + name), 0)).toBeLessThanOrEqual(785000);
  });
});
