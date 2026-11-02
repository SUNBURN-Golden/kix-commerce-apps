import ts from "typescript";
import type { Plugin } from "vite";

const HELPER = "\0kix-locale-rows";
export const LOCALE_ROWS_HELPER = `export function localeRows(rows) {
  return {
    en: Object.fromEntries(rows.map(([key, en]) => [key, en])),
    ko: Object.fromEntries(rows.map(([key, en, ko = en]) => [key, ko]))
  };
}`;

/** Build-only template; preserve both dictionaries, with one copy of each key. */
export function compactLocaleCopy(source: string, file: string): string | null {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const declarations = ast.statements.filter((node) => !ts.isImportDeclaration(node));
  if (declarations.length !== 1 || !ts.isVariableStatement(declarations[0])) return null;
  const variables = declarations[0].declarationList.declarations;
  const declaration = variables[0];
  if (!declaration || variables.length !== 1 || declaration.name.getText(ast) !== "messages") return null;
  const initializer = declaration.initializer;
  if (!initializer) return null;
  let value = initializer;
  if (value && ts.isAsExpression(value)) value = value.expression;
  if (!value || !ts.isObjectLiteralExpression(value) || value.properties.length !== 2) return null;
  const dictionaries = new Map<string, Map<string, string>>();
  for (const property of value.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) return null;
    const name = property.name.getText(ast);
    if (name !== "en" && name !== "ko") return null;
    const entries = new Map<string, string>();
    for (const entry of property.initializer.properties) {
      if (!ts.isPropertyAssignment(entry) || (!ts.isStringLiteral(entry.name) && !ts.isIdentifier(entry.name))) return null;
      // Constant copy only: preserve evaluation behavior by skipping effectful expressions.
      if (!ts.isStringLiteral(entry.initializer) && !ts.isIdentifier(entry.initializer)) return null;
      const key = entry.name.text;
      if (entries.has(key) || key === "__proto__") return null;
      entries.set(key, entry.initializer.getText(ast));
    }
    dictionaries.set(name, entries);
  }
  const en = dictionaries.get("en");
  const ko = dictionaries.get("ko");
  if (!en || !ko || JSON.stringify([...en.keys()]) !== JSON.stringify([...ko.keys()])) return null;
  const rows = [...en].map(([key, english]) => `[${JSON.stringify(key)},${english}${english === ko.get(key) ? "" : `,${ko.get(key)}`}]`);
  return `import { localeRows as __kixLocaleRows } from ${JSON.stringify(HELPER)};\n`
    + source.slice(0, initializer.getStart(ast)) + `__kixLocaleRows([${rows.join(",")}])` + source.slice(initializer.end);
}

export function localeCopyTemplates(): Plugin {
  return {
    name: "kix-locale-copy-templates", apply: "build", enforce: "pre",
    resolveId(id) { if (id === HELPER) return id; },
    load(id) { if (id === HELPER) return LOCALE_ROWS_HELPER; },
    transform(source, id) {
      if (!/\/src\/i18n\/messages\/[^/]+\.ts$/.test(id)) return;
      const code = compactLocaleCopy(source, id);
      if (code) return { code, map: null };
    },
  };
}
