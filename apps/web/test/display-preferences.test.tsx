import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { prefersReducedMotion, REDUCED_MOTION_QUERY } from "../src/a11y/motion";
import { makeTranslate } from "../src/i18n/translate";
import { transportBannerText } from "../src/transport-status";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");

/**
 * Contrast is computed with the WCAG 2.x relative-luminance formula
 * (WCAG 2.2, SC 1.4.3). The 4.5:1 figure is the named criterion this test
 * computes against; it is a calculation, not a conformance or acceptance
 * claim. The target standard stays UNDETERMINED.
 */
const CONTRAST_CRITERION = { name: "WCAG 2.2 SC 1.4.3", minimum: 4.5 } as const;

function block(query: string): string {
  const start = css.indexOf(query);
  expect(start, query).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") {
      depth += 1;
    } else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(open + 1, i);
      }
    }
  }
  throw new Error(`unclosed block after ${query}`);
}

function tokens(section: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of section.matchAll(/--([a-z-]+):\s*([^;]+);/g)) {
    out[match[1]!] = match[2]!.trim();
  }
  return out;
}

function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const channel = (i: number) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The token pairs that carry text or an icon on a surface, on every screen. */
const TEXT_PAIRS: readonly [string, string][] = [
  ["ink", "paper"],
  ["ink", "card"],
  ["ink", "field"],
  ["muted", "card"],
  ["muted", "paper"],
  ["stamp", "card"],
  ["stamp", "paper"],
  ["ok", "card"],
  ["paper", "ink"],
];

describe("display preferences (stub)", () => {
  it("keeps colours in tokens and computes the WCAG 2.2 contrast of every text pair in both schemes", () => {
    const light = tokens(block(":root"));
    const dark = tokens(block("@media (prefers-color-scheme: dark)"));
    for (const name of ["paper", "card", "field", "ink", "muted", "line", "stamp", "ok"]) {
      expect(light[name], `light --${name}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(dark[name], `dark --${name}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
    for (const palette of [light, dark]) {
      for (const [fg, bg] of TEXT_PAIRS) {
        const ratio = contrast(palette[fg]!, palette[bg]!);
        expect(
          ratio,
          `${CONTRAST_CRITERION.name}: --${fg} on --${bg} computes ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(CONTRAST_CRITERION.minimum);
      }
    }
    expect(css).toContain("color-scheme: light dark");
    expect(css).not.toContain("background: white");
  });

  it("maps the tokens onto platform system colours under forced colours", () => {
    const forced = tokens(block("@media (forced-colors: active)"));
    expect(forced.paper).toBe("Canvas");
    expect(forced.card).toBe("Canvas");
    expect(forced.field).toBe("Field");
    expect(forced.ink).toBe("CanvasText");
    expect(forced.line).toBe("CanvasText");
    expect(forced.shadow).toBe("none");
    // A second, non-colour mark for the current nav link.
    expect(block("@media (forced-colors: active)")).toContain('nav a[aria-current="page"]');
    expect(block("@media (forced-colors: active)")).toContain("text-decoration: underline");
  });

  it("turns motion off under reduced motion and owns no motion of its own", () => {
    const reduced = block("@media (prefers-reduced-motion: reduce)");
    expect(reduced).toContain("animation-duration");
    expect(reduced).toContain("animation-iteration-count");
    expect(reduced).toContain("transition-duration");
    expect(reduced).toContain("scroll-behavior: auto");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/(^|[^-\w])animation\s*:/);
    expect(css).not.toMatch(/(^|[^-\w])transition\s*:/);
    expect(css).not.toMatch(/scroll-behavior\s*:\s*smooth/);
  });

  it("reads the reduced-motion preference as the user's stop for the timed probe", () => {
    expect(prefersReducedMotion(() => true)).toBe(true);
    expect(prefersReducedMotion(() => false)).toBe(false);
    expect(prefersReducedMotion((query) => query === REDUCED_MOTION_QUERY)).toBe(true);
    expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");

    const shell = readFileSync(path.join(webRoot, "src/components/Shell.tsx"), "utf8");
    expect(shell).toContain("motionPaused");
    expect(shell).toContain("REDUCED_MOTION_QUERY");
    const t = makeTranslate("en");
    const paused = transportBannerText("integration-http", null, t, true);
    expect(paused.text).toContain("re-probing is stopped");
    const running = transportBannerText("integration-http", null, t, false);
    expect(running.text).not.toContain("re-probing is stopped");
    const stub = transportBannerText("stub", null, t, true);
    expect(stub.text).not.toContain("re-probing is stopped");
  });

  it("prints receipts and the handoff packet as documents", () => {
    const print = block("@media print");
    expect(print).toContain(".receipt-nav");
    expect(print).toContain(".top nav");
    expect(print).toContain(".skip");
    expect(print).toMatch(/display:\s*none/);
    expect(print).toContain("attr(href)");
    expect(print).toContain("Synthetic stub display");
    expect(print).toContain(".receipt::before");
    expect(print).toContain(".handoff::before");
  });

  it("keeps the narrow layout fix that lets long tokens wrap on the handoff packet", () => {
    expect(css).toMatch(/\.handoff li,\s*\.handoff p\s*{[^}]*overflow-wrap:\s*anywhere/);
    const handoff = readFileSync(path.join(webRoot, "src/pages/Handoff.tsx"), "utf8");
    for (const label of ["Supported commands, scrollable", "Pending producers, scrollable", "Feature status, scrollable"]) {
      expect(handoff).toContain(`aria-label="${label}"`);
    }
    expect(handoff.match(/className="handoff-scroll"[^>]*tabIndex=\{0\}/g)?.length).toBe(3);
  });
});
