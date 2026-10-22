import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOOPBACK_ARGS, launchArgs, launchEnv } from "../../src/browser";
import { findSensitiveInRecord } from "../../src/redact";
import { recordCheck } from "../../src/run-record";
import { useBrowser } from "../../src/suite";
import {
  assertUpdateAllowed,
  barPng,
  baselineProblems,
  comparePngs,
  diffPpm,
  openShot,
  passes,
  pngSize,
  renderProfile,
  settleShot,
  type BaselineManifest,
} from "../../src/visual-compare";
import { FIXED_TIME_ISO, TOLERANCE, VISUAL_FONTS_CONF, VISUAL_FONT_FILES, VISUAL_SESSION, VISUAL_STATIC_CHECK_IDS, expectedVisualCheckIds, idOf, visualShots } from "../../src/visual-matrix";
import { VISUAL_NOT_RUN, koreanLayoutNote, renderVisualRecord, type VisualRecord } from "../../src/visual-record";
import { useVisual } from "./helpers";

describe("visual harness self-checks (stub, headless Chrome)", () => {
  const suite = useBrowser(VISUAL_SESSION);
  const visual = useVisual(suite);

  it("the matrix is 32 distinct shots and every id has a check id", () => {
    const ids = visualShots().map(idOf);
    expect(ids).toHaveLength(32);
    expect(new Set(ids).size).toBe(32);
    expect(expectedVisualCheckIds()).toHaveLength(32 + VISUAL_STATIC_CHECK_IDS.length);
    expect(new Set(visualShots().map((shot) => shot.viewport))).toEqual(new Set(["phone", "desktop"]));
    expect(new Set(visualShots().map((shot) => shot.locale))).toEqual(new Set(["en", "ko"]));
    expect(new Set(visualShots().map((shot) => shot.scheme))).toEqual(new Set(["light", "dark", "forced-colors"]));
  });

  it("identical pictures differ by 0 pixels", async () => {
    const a = await barPng(visual.helper(), 200, 60, 10);
    const b = await barPng(visual.helper(), 200, 60, 10);
    const compared = await comparePngs(visual.helper(), a, b);
    expect(compared).toMatchObject({ sizeMatch: true, diffPixels: 0, diffPng: null });
    expect(passes(compared.diffPixels, 200, 60)).toBe(true);
    recordCheck("visual.harness.identical");
  });

  it("a 1px shift of a bar fails, and the diff picture is written", async () => {
    const a = await barPng(visual.helper(), 200, 60, 10);
    const b = await barPng(visual.helper(), 200, 60, 11);
    const compared = await comparePngs(visual.helper(), a, b);
    expect(compared.diffPixels).toBe(20);
    expect(passes(compared.diffPixels, 200, 60)).toBe(false);
    expect(compared.diffPng && pngSize(compared.diffPng)).toEqual({ width: 200, height: 60 });
    expect(diffPpm(20, 200, 60)).toBe(1667);
    // Noise inside the allowance passes: 1 pixel of a 390x844 picture is 3 ppm.
    expect(passes(1, 390, 844)).toBe(true);
    expect(passes(Math.ceil((TOLERANCE.maxDiffPpm * 390 * 844) / 1_000_000) + 1, 390, 844)).toBe(false);
    recordCheck("visual.harness.shifted");
  });

  it("a picture of another size always fails, even with no differing pixel to count", async () => {
    const a = await barPng(visual.helper(), 200, 60, 10);
    const b = await barPng(visual.helper(), 200, 61, 10);
    const compared = await comparePngs(visual.helper(), a, b);
    expect(compared.sizeMatch).toBe(false);
    expect(compared.actual).toEqual({ width: 200, height: 60 });
    expect(compared.expected).toEqual({ width: 200, height: 61 });
    recordCheck("visual.harness.size-mismatch");
  });

  it("recording baselines is refused when CI is set, in the setup check and in the shot path", async () => {
    expect(() => assertUpdateAllowed({ KIX_VISUAL_UPDATE: "1", CI: "true" })).toThrow(/refused when CI is set/);
    expect(() => assertUpdateAllowed({ KIX_VISUAL_UPDATE: "1" })).not.toThrow();
    expect(() => assertUpdateAllowed({ CI: "true" })).not.toThrow();
    const picture = await barPng(visual.helper(), 200, 60, 10);
    await expect(settleShot(visual.helper(), visual.profile(), "x.phone.en.light", picture, { KIX_VISUAL_UPDATE: "1", CI: "true" })).rejects.toThrow(/refused when CI is set/);
    recordCheck("visual.harness.update-refused-in-ci");
  });

  it("a baseline set must match the shot ids exactly and state the tolerance", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kix-visual-set-"));
    try {
      const ids = ["a.phone.en.light", "b.desktop.ko.light"];
      const picture = await barPng(visual.helper(), 390, 100, 10);
      const dir = path.join(root, "linux-0a1b2c3d");
      fs.mkdirSync(dir);
      for (const id of ids) {
        fs.writeFileSync(path.join(dir, `${id}.png`), picture);
      }
      const manifest: BaselineManifest = {
        profile: "linux-0a1b2c3d",
        platform: "linux",
        chrome: "test",
        fontWidths: {},
        cjkGlyphs: "present",
        tolerance: { ...TOLERANCE },
        appHead: "unknown",
        recordedOn: "2026-10-21",
        shots: ids.length,
      };
      const writeManifest = (value: object) => fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(value));
      writeManifest(manifest);
      expect(baselineProblems(root, ids)).toEqual([]);
      fs.writeFileSync(path.join(dir, "stray.desktop.en.light.png"), picture);
      expect(baselineProblems(root, ids)).toEqual(["linux-0a1b2c3d: baseline matches no shot: stray.desktop.en.light.png"]);
      fs.rmSync(path.join(dir, "stray.desktop.en.light.png"));
      fs.rmSync(path.join(dir, `${ids[1]}.png`));
      expect(baselineProblems(root, ids)).toEqual([`linux-0a1b2c3d: missing baseline ${ids[1]}.png`]);
      fs.writeFileSync(path.join(dir, `${ids[1]}.png`), picture);
      writeManifest({ ...manifest, tolerance: { channelDelta: 99, maxDiffPpm: 200 } });
      expect(baselineProblems(root, ids)).toEqual(["linux-0a1b2c3d: manifest tolerance differs from the matrix tolerance"]);
      writeManifest(manifest);
      fs.writeFileSync(path.join(dir, `${ids[0]}.png`), "not a png");
      expect(baselineProblems(root, ids)).toEqual([`linux-0a1b2c3d: ${ids[0]}.png is not a PNG`]);
      expect(baselineProblems(path.join(root, "none"), ids)).toEqual(["no baseline profile is committed"]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
    recordCheck("visual.harness.baseline-set");
  });

  it("the loopback launch flags cannot be removed or overridden, and the pinned session settings are in force", async () => {
    const args = launchArgs(VISUAL_SESSION.args);
    for (const flag of LOOPBACK_ARGS) {
      expect(args).toContain(flag);
    }
    expect(args).toContain("--font-render-hinting=none");
    for (const reserved of ["--host-resolver-rules=MAP * 8.8.8.8", "--proxy-server=http://127.0.0.1:1", "--proxy-pac-url=x", "--no-sandbox", "--remote-debugging-port=9222", "--disable-web-security", "--user-data-dir=/tmp/x"]) {
      expect(() => launchArgs([reserved]), reserved).toThrow(/reserved by the harness/);
    }
    const page = await suite.newPage();
    await openShot(page, suite.origin, { screenId: "help", path: "/help", viewport: "phone", locale: "en", scheme: "light" });
    const probe = await page.evaluate(() => ({
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ratio: window.devicePixelRatio,
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      now: new Date().toISOString(),
      width: window.innerWidth,
    }));
    expect(probe).toEqual({ zone: "UTC", ratio: 1, reduced: true, now: FIXED_TIME_ISO, width: 390 });
    await page.close();
    recordCheck("visual.harness.launch-flags");
  });

  it("the session pins the vendored font set, so no machine font reaches a picture", async () => {
    expect(VISUAL_SESSION.env?.FONTCONFIG_FILE).toBe(VISUAL_FONTS_CONF);
    const fontsDir = path.dirname(VISUAL_FONTS_CONF);
    for (const file of [...VISUAL_FONT_FILES, "fonts.conf", "OFL.txt"]) {
      expect(fs.existsSync(path.join(fontsDir, file)), file).toBe(true);
    }
    for (const bad of ["HTTP_PROXY", "https_proxy", "LD_PRELOAD"].map((name) => ({ [name]: "x" }) as Record<string, string>)) {
      expect(() => launchEnv(bad), Object.keys(bad).join(",")).toThrow(/reserved by the harness/);
    }
    // document.fonts.check cannot tell a system family apart, so this measures widths: a family that is
    // not vendored must land on the vendored file, not on whatever the machine would have offered.
    const widths = await visual.helper().evaluate(() => {
      const pen = document.createElement("canvas").getContext("2d");
      if (!pen) {
        throw new Error("No 2d canvas.");
      }
      const measure = (font: string, text: string): number => {
        pen.font = font;
        return pen.measureText(text).width;
      };
      const latin = "Box office 0123456789";
      const korean = "박스오피스 영수증 가나다";
      return {
        vendored: measure('16px "NanumGothic"', latin),
        arial: measure("16px Arial", latin),
        dejavu: measure('16px "DejaVu Sans"', latin),
        serif: measure("16px Palatino,Georgia,serif", latin),
        vendoredSerif: measure('16px "NanumMyeongjo"', latin),
        koreanInSansStack: measure('16px "Avenir Next","Segoe UI",sans-serif', korean),
        koreanInVendored: measure('16px "NanumGothic"', korean),
      };
    });
    expect(widths.arial).toBe(widths.vendored);
    expect(widths.dejavu).toBe(widths.vendored);
    expect(widths.serif).toBe(widths.vendoredSerif);
    expect(widths.serif).not.toBe(widths.vendored);
    expect(widths.koreanInSansStack).toBe(widths.koreanInVendored);
    recordCheck("visual.harness.fonts");
  });

  it("the render profile is stable, carries no Chrome version, and says whether Korean glyphs are drawn", async () => {
    const again = await renderProfile(visual.helper(), suite.session().version);
    expect(again).toEqual(visual.profile());
    expect(visual.profile().profile).toMatch(/^[a-z0-9]+-[0-9a-f]{8}$/);
    expect(visual.profile().profile).not.toContain(suite.session().version);
    expect(["present", "missing"]).toContain(visual.profile().cjkGlyphs);
    recordCheck("visual.harness.profile");
  });

  it("the run record passes the redaction scan with a realistic ratio, profile and git id, and the old decimal shape would not", () => {
    // A decimal ratio holds a long digit run; the record stores whole parts per million instead.
    expect(findSensitiveInRecord({ ratio: 123 / 3_800_000 })).toEqual(["long-digits"]);
    const record: VisualRecord = {
      kind: "visual-baseline-observation",
      mode: "stub",
      run: "compare",
      bind: "127.0.0.1",
      date: "2026-10-21",
      appHead: "c17425a76a48010fa4ece21554538337cc301a5a",
      baseMainSha: "unknown",
      chrome: "155.0.8059.84",
      playwrightCore: "1.58.2",
      profile: "linux-12345678",
      cjkGlyphs: "missing",
      koreanLayout: koreanLayoutNote("missing"),
      tolerance: { ...TOLERANCE },
      shots: [{ id: "box-office.desktop.en.light", width: 1280, height: 1436, diffPixels: 123, diffPpm: 67, result: "MATCH" }],
      ledger: { nonLoopback: 0, nonGet: 0, appNetworkCalls: 0 },
      claims: { qualification: false, userAccepted: false, released: false, designApproved: false, otherRunners: false },
      notRun: [...VISUAL_NOT_RUN],
    };
    const text = renderVisualRecord(record);
    expect(JSON.parse(text).shots[0].diffPpm).toBe(67);
    expect(JSON.parse(text).koreanLayout).toContain("Korean layout not verified on this profile");
    expect(koreanLayoutNote("present")).not.toContain("not verified");
    expect(() => renderVisualRecord({ ...record, profile: "linux-1/123456789" })).toThrow(/looks sensitive/);
    recordCheck("visual.harness.record-redaction");
  });
});
