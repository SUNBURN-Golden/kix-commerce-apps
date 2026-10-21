import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const DISPLAY_ATTRIBUTES = new Set(["aria-label", "aria-description", "title", "alt", "placeholder", "label", "applyLabel", "copyLabel", "word"]);
export const VERBATIM = new Map([
  ["KIX", "Product name"],
  ["SCREEN_LOAD_FAILED", "Screen loader diagnostic code"],
  ["SYNTHETIC", "Provenance enum"],
  ["SYNTHETIC.", "Provenance enum with sentence punctuation"],
  ["UNKNOWN", "Outcome enum"],
  ["NOT_BOUND", "Binding enum"],
  ["STALE", "Freshness enum"],
  ["UNDETERMINED", "Undecided-policy enum"],
  ["UNSUPPORTED", "Capability enum"],
  ["false", "Literal truth flag"],
  ["true", "Literal truth flag"],
]);

const normalize = (value) => value.replace(/\s+/g, " ").trim();

export function auditSource(source, file = "screen.tsx") {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  const seen = new Set();
  function report(node, value, kind) {
    const text = normalize(value);
    if (!/[\p{L}]/u.test(text) || VERBATIM.has(text)) return;
    const start = node.getStart(ast);
    const identity = `${start}:${kind}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    const { line, character } = ast.getLineAndCharacterOfPosition(start);
    findings.push({ file, line: line + 1, column: character + 1, kind, text });
  }
  function displayExpression(node, kind) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      report(node, node.text, kind);
    } else if (ts.isCallExpression(node)) {
      // Catalogue keys are the only display call arguments exempt from the literal guard.
      if (ts.isIdentifier(node.expression) && ["t", "tr"].includes(node.expression.text)) return;
      for (const argument of node.arguments) displayExpression(argument, kind);
    } else if (ts.isTemplateExpression(node)) {
      report(node, [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" {value} "), kind);
    } else if (ts.isConditionalExpression(node)) {
      displayExpression(node.whenTrue, kind);
      displayExpression(node.whenFalse, kind);
    } else if (ts.isParenthesizedExpression(node)) {
      displayExpression(node.expression, kind);
    } else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.PlusToken].includes(node.operatorToken.kind)) {
      if (node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) displayExpression(node.left, kind);
      displayExpression(node.right, kind);
    }
  }
  function visit(node) {
    if (ts.isJsxText(node)) report(node, node.text, "text");
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) displayExpression(node.expression, "expression");
    if (ts.isJsxAttribute(node) && DISPLAY_ATTRIBUTES.has(node.name.getText(ast)) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) report(node.initializer, node.initializer.text, "attribute");
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) displayExpression(node.initializer.expression, "attribute");
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return findings;
}

export function auditTree(root) {
  const findings = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith(".tsx")) findings.push(...auditSource(readFileSync(file, "utf8"), path.relative(root, file)));
    }
  }
  walk(root);
  return findings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../apps/web/src", import.meta.url));
  const findings = auditTree(root);
  const byFile = {};
  for (const finding of findings) byFile[finding.file] = (byFile[finding.file] ?? 0) + 1;
  console.log(JSON.stringify({ findings: findings.length, byFile, details: process.argv.includes("--details") ? findings : undefined }, null, 2));
  process.exitCode = findings.length === 0 ? 0 : 1;
}
