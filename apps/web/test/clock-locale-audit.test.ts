import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditClockSource, auditClockTree } from "./support/clock-locale-audit";

describe("explicit display locale AST guard", () => {
  it("finds zero locale-less calls throughout web source", () => {
    expect(auditClockTree(path.resolve("src"))).toEqual([]);
  });

  it("fails on deliberately locale-less calls in a scratch tree, exempting only exact paths", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "kix-clock-audit-"));
    try {
      mkdirSync(path.join(root, "a11y"));
      mkdirSync(path.join(root, "nested"));
      const violation = "formatWhen(row.startsAt);";
      writeFileSync(path.join(root, "format.ts"), violation);
      writeFileSync(path.join(root, "a11y/present.ts"), violation);
      writeFileSync(path.join(root, "nested/format.ts"), violation);
      writeFileSync(path.join(root, "scratch.tsx"), `
        import { formatWhen as when } from './format';
        formatWhen(row.startsAt);
        presentInstant(x);
        presentDeadline({ expiresAt, expired });
        when(x);
      `);
      const findings = auditClockTree(root);
      expect(findings.filter((item) => item.file === "scratch.tsx")).toHaveLength(4);
      expect(findings).toHaveLength(5);
      expect(findings[0]).toMatchObject({ file: "nested/format.ts", line: 1, column: 1, callee: "formatWhen" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects namespace calls, non-literal deadlines and explicitly missing locale values", () => {
    expect(auditClockSource(`
      import * as format from './format';
      import * as presentation from './a11y/present';
      format.formatWhen(iso);
      presentation.presentInstant(iso);
      presentation.presentDeadline({ expiresAt, expired });
      presentDeadline(input);
      formatWhen(iso, undefined);
      presentInstant(iso, (undefined as any));
      presentDeadline({ expiresAt, expired, locale: undefined });
      presentInstant(iso, void 0);
      formatWhen(iso, null);
      presentation['presentInstant'](iso);
    `, "namespace.tsx")).toHaveLength(10);
  });

  it("accepts explicit positional locales and deadline property or shorthand locales", () => {
    expect(auditClockSource(`
      import { presentInstant as instant } from './a11y/present';
      formatWhen(iso, clock);
      instant(iso, 'ko-KR');
      format.formatWhen(iso, locale);
      presentDeadline({ expiresAt, expired, locale });
      presentation.presentDeadline({ expiresAt, expired, locale: clock });
    `, "valid.tsx")).toEqual([]);
  });
});
