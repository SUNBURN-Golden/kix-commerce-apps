import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  JOURNEYS,
  KEYBOARD_DENOMINATOR,
  KEYBOARD_NO_WRITE,
  KEYBOARD_OUTCOME_CHECK_IDS,
  MATRIX,
  OUTCOMES,
  expectedCheckIds,
  keyboardFacet,
  keyboardFacetLine,
  keyboardFacetProblems,
  matrixProblems,
  SEND_CONTROL_JOURNEYS,
  oneAttemptCheckIds,
} from "../src/journey-matrix";
import { KEYBOARD_DRIVES } from "../src/keyboard-outcomes";
import { expectedCheckIds as a11yCheckIds } from "../src/a11y-matrix";
import { NOT_RUN, renderRecord, type RunRecord } from "../src/run-record";

describe("journey matrix", () => {
  it("has exactly one cell for every journey and outcome, each with the evidence its kind needs", () => {
    expect(MATRIX).toHaveLength(JOURNEYS.length * OUTCOMES.length);
    expect(matrixProblems()).toEqual([]);
  });

  it("names a unique check for every browser or checked reference cell", () => {
    const ids = MATRIX.filter((cell) => cell.checkId).map((cell) => cell.checkId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(expectedCheckIds()).toEqual(expect.arrayContaining(ids as string[]));
  });

  it("marks only honestly unreachable UNKNOWN cells as not reachable, each owned by the fault-injection node", () => {
    const unreachable = MATRIX.filter((cell) => cell.kind === "NOT_REACHABLE");
    expect(unreachable.every((cell) => cell.outcome === "UNKNOWN" && cell.owner === "c-fault-injection-stub")).toBe(true);
    expect(unreachable.map((cell) => cell.journey).sort()).toEqual(["admission", "box-office", "credit", "marketing", "marketing-m01", "marketing-m02", "marketing-m03", "marketing-m04"]);
  });

  it("requires every send journey one-attempt check, including the existing booking checks", () => {
    for (const journey of SEND_CONTROL_JOURNEYS) {
      expect(expectedCheckIds()).toEqual(expect.arrayContaining([...oneAttemptCheckIds(journey)]));
    }
    expect(oneAttemptCheckIds("booking")).toEqual(["one-attempt.double-click", "one-attempt.keyboard", "one-attempt.reload"]);
  });

  it("renders a run record that claims no HTTP-mode pass, no production qualification and no payment", () => {
    const record: RunRecord = {
      mode: "stub",
      bind: "127.0.0.1",
      date: "2026-10-16",
      chrome: "Chrome test",
      playwrightCore: "1.58.2",
      baseMainSha: "0".repeat(7),
      ledger: { nonLoopback: 0, nonGet: 0, appNetworkCalls: 0 },
      claims: { httpModePass: false, productionQualification: false, realPayment: false, released: false },
      checks: [{ checkId: "x", pass: true }],
      notRun: [...NOT_RUN],
    };
    const parsed = JSON.parse(renderRecord(record)) as RunRecord;
    expect(Object.values(parsed.claims).every((value) => value === false)).toBe(true);
    expect(parsed.notRun.join(" ")).toMatch(/HTTP mode/);
    expect(() => renderRecord({ ...record, chrome: "owner@example.com" })).toThrow(/sensitive/);
  });

  describe("keyboard facet", () => {
    const bindDoc = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../docs/c-plan-d-keyboard-outcome-journeys-stub-apps-bind.md"), "utf8");

    it("gives every BROWSER SUCCESS/REJECT/UNKNOWN cell a keyboard check and every other cell a NOT_APPLICABLE reason", () => {
      expect(keyboardFacetProblems()).toEqual([]);
      const browserTargets = MATRIX.filter((cell) => cell.kind === "BROWSER" && cell.outcome !== "NOT_BOUND");
      const line = keyboardFacetLine();
      console.log(`${line} (BROWSER cells in the matrix: ${MATRIX.filter((cell) => cell.kind === "BROWSER").length}, of which NOT_BOUND ${MATRIX.filter((cell) => cell.kind === "BROWSER" && cell.outcome === "NOT_BOUND").length} are NOT_APPLICABLE)`);
      expect(KEYBOARD_DENOMINATOR).toBe(browserTargets.length);
      expect(KEYBOARD_DENOMINATOR).toBe(85);
      expect(KEYBOARD_OUTCOME_CHECK_IDS).toHaveLength(KEYBOARD_DENOMINATOR);
      expect(line).toBe(`keyboard facet: ${browserTargets.length} / ${browserTargets.length} BROWSER SUCCESS/REJECT/UNKNOWN cells`);
      for (const cell of MATRIX) {
        const facet = keyboardFacet(cell);
        if (cell.kind === "BROWSER" && cell.outcome !== "NOT_BOUND") {
          expect(facet.kind, `${cell.journey}/${cell.outcome}`).toBe("CHECK");
        } else {
          expect(facet.kind, `${cell.journey}/${cell.outcome}`).toBe("NOT_APPLICABLE");
          expect(facet.kind === "NOT_APPLICABLE" && facet.reason.length > 20, `${cell.journey}/${cell.outcome} reason`).toBe(true);
          // REFERENCE and NOT_REACHABLE cells keep their pointer and owner.
          if (cell.kind !== "BROWSER") expect(Boolean(cell.pointer && cell.owner)).toBe(true);
        }
      }
      expect(MATRIX.filter((cell) => keyboardFacet(cell).kind === "NOT_APPLICABLE")).toHaveLength(MATRIX.length - KEYBOARD_DENOMINATOR);
      expect(MATRIX.filter((cell) => keyboardFacet(cell).kind === "NOT_APPLICABLE")).toHaveLength(55);
    });

    it("has exactly one keyboard-only drive per check, registered in the accessibility matrix", () => {
      const ids = KEYBOARD_DRIVES.map((drive) => drive.checkId);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort()).toEqual([...KEYBOARD_OUTCOME_CHECK_IDS].sort());
      expect(a11yCheckIds()).toEqual(expect.arrayContaining([...KEYBOARD_OUTCOME_CHECK_IDS, "a11y.kbd.outcome.pointer-guard", "a11y.kbd.outcome.live-probe"]));
      // Keyboard ids belong to the accessibility suite; the journey suite's own expected ids are unchanged.
      expect(expectedCheckIds().some((id) => id.startsWith("a11y."))).toBe(false);
    });

    it("gives each REJECT/UNKNOWN drive the fence its cell states; every NO_WRITE cell is listed with a reason", () => {
      for (const drive of KEYBOARD_DRIVES) {
        const cell = MATRIX.find((item) => `a11y.kbd.outcome.${item.journey}.${item.outcome}` === drive.checkId);
        expect(cell, drive.checkId).toBeDefined();
        const facet = cell ? keyboardFacet(cell) : null;
        expect(facet?.kind).toBe("CHECK");
        if (!facet || facet.kind !== "CHECK") continue;
        const last = drive.trigger[drive.trigger.length - 1];
        expect(last && ("press" in last || "type" in last), `${drive.checkId} ends with a key`).toBe(true);
        if (facet.fence === "NONE") {
          expect(drive.fence ?? drive.noWrite, `${drive.checkId} SUCCESS has no fence`).toBeUndefined();
          expect(drive.result, drive.checkId).toBe("SUCCESS");
        } else if (facet.fence === "FENCED") {
          expect(drive.fence, drive.checkId).toBeTruthy();
          expect(drive.noWrite, drive.checkId).toBeUndefined();
        } else {
          expect(facet.fence, drive.checkId).toBe("NO_WRITE");
          expect(drive.noWrite, drive.checkId).toBeDefined();
          expect(drive.fence, drive.checkId).toBeUndefined();
        }
      }
      for (const [key, reason] of Object.entries(KEYBOARD_NO_WRITE)) {
        expect(reason?.length ?? 0, key).toBeGreaterThan(30);
      }
      // receipts.REJECT is the owner ruling's own example of a NO_WRITE cell.
      expect(KEYBOARD_NO_WRITE["receipts.REJECT"]).toBeDefined();
    });

    it("lists every check in the bind doc with its focus rule and fence, and every NO_WRITE and NOT_APPLICABLE cell", () => {
      for (const drive of KEYBOARD_DRIVES) {
        const row = bindDoc.split("\n").find((line) => line.startsWith(`| \`${drive.checkId}\` |`));
        expect(row, `bind doc row for ${drive.checkId}`).toBeDefined();
        expect(row).toContain(` ${drive.focus} `);
        expect(row).toContain(` ${keyboardFacetForCell(drive.checkId)} `);
      }
      for (const key of Object.keys(KEYBOARD_NO_WRITE)) {
        expect(bindDoc, key).toContain(`\`${key}\``);
      }
      for (const cell of MATRIX.filter((item) => keyboardFacet(item).kind === "NOT_APPLICABLE")) {
        expect(bindDoc, `${cell.journey}.${cell.outcome}`).toContain(`\`${cell.journey}.${cell.outcome}\``);
      }
      expect(bindDoc).toContain("Human acceptance: PENDING");
      expect(bindDoc).toContain("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
      expect(bindDoc).toContain("2026-10-26 13:06 KST");
      for (const word of ["ACCEPTED", "APPROVED"]) {
        expect(bindDoc.includes(word), word).toBe(false);
      }
    });
  });
});

function keyboardFacetForCell(checkId: string): string {
  const cell = MATRIX.find((item) => `a11y.kbd.outcome.${item.journey}.${item.outcome}` === checkId);
  const facet = cell ? keyboardFacet(cell) : null;
  return facet && facet.kind === "CHECK" ? facet.fence : "MISSING";
}
