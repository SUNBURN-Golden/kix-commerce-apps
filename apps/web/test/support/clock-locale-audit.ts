import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const clocks = new Set(["formatWhen", "presentInstant", "presentDeadline"]);
export interface ClockFinding { file: string; line: number; column: number; callee: string }

function missing(node: ts.Expression | undefined): boolean {
  if (!node) return true;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) return missing(node.expression);
  return (ts.isIdentifier(node) && node.text === "undefined") || ts.isVoidExpression(node) || node.kind === ts.SyntaxKind.NullKeyword;
}

/** Calls must carry an explicit display locale, including aliased and namespace imports. */
export function auditClockSource(source: string, file: string): ClockFinding[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Map([...clocks].map((name) => [name, name]));
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const specifier of bindings.elements) {
        const imported = (specifier.propertyName ?? specifier.name).text;
        if (clocks.has(imported)) names.set(specifier.name.text, imported);
      }
    }
  }
  const findings: ClockFinding[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = ts.isIdentifier(node.expression) ? names.get(node.expression.text)
        : ts.isPropertyAccessExpression(node.expression) && clocks.has(node.expression.name.text) ? node.expression.name.text
        : ts.isElementAccessExpression(node.expression) && ts.isStringLiteral(node.expression.argumentExpression) && clocks.has(node.expression.argumentExpression.text) ? node.expression.argumentExpression.text
        : undefined;
      if (callee) {
        let absent = missing(node.arguments[1]);
        if (callee === "presentDeadline") {
          const input = node.arguments[0];
          const property = input && ts.isObjectLiteralExpression(input) ? input.properties.find((item) =>
            (ts.isPropertyAssignment(item) || ts.isShorthandPropertyAssignment(item)) && item.name.getText(ast).replace(/["']/g, "") === "locale") : undefined;
          absent = !property || (ts.isPropertyAssignment(property) && missing(property.initializer));
        }
        if (absent) {
          const pos = ast.getLineAndCharacterOfPosition(node.getStart(ast));
          findings.push({ file, line: pos.line + 1, column: pos.character + 1, callee });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return findings;
}

export function auditClockTree(root: string): ClockFinding[] {
  const exempt = new Set(["format.ts", "a11y/present.ts"]);
  function walk(directory: string): ClockFinding[] {
    return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return walk(file);
      const relative = path.relative(root, file).split(path.sep).join("/");
      return /\.tsx?$/.test(file) && !exempt.has(relative) ? auditClockSource(readFileSync(file, "utf8"), relative) : [];
    });
  }
  return walk(root);
}
