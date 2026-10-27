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
  layoutProblems,
  maskProblems,
  pngHash,
  passes,
  pngSize,
  renderProfile,
  settleShot,
  type BaselineManifest,
} from "../../src/visual-compare";
import { APP_ROUTES, ROUTES } from "../../../web/src/shell/route-registry";
import { FIXED_TIME_ISO, VISUAL_SCREENS, VISUAL_EXCLUSIONS, VISUAL_MASKS, MAX_SHOT_HEIGHT, visualRouteProblems, TOLERANCE, VISUAL_FONTS_CONF, VISUAL_FONT_FILES, VISUAL_SESSION, VISUAL_STATIC_CHECK_IDS, expectedVisualCheckIds, idOf, visualShots } from "../../src/visual-matrix";
import { VISUAL_NOT_RUN, koreanLayoutNote, renderVisualRecord, type VisualRecord } from "../../src/visual-record";
import { lifecycleFixture, timingFixture } from "../record-fixtures";
import { useVisual } from "./helpers";

describe("visual harness self-checks (stub, headless Chrome)", () => {
  const suite = useBrowser(VISUAL_SESSION);
  const visual = useVisual(suite);

  it("the matrix is 94 distinct shots and every id has a check id", () => {
    const ids = visualShots().map(idOf);
    expect(ids).toHaveLength(94);
    for (const screen of VISUAL_SCREENS.filter((item) => item.matrix === "coverage")) {
      expect(ids.filter((id) => id.startsWith(`${screen.screenId}.`))).toEqual([`${screen.screenId}.phone.ko.light`, `${screen.screenId}.desktop.en.light`]);
    }
    expect(new Set(ids).size).toBe(94);
    expect(expectedVisualCheckIds()).toHaveLength(94 + VISUAL_STATIC_CHECK_IDS.length);
    expect(new Set(visualShots().map((shot) => shot.viewport))).toEqual(new Set(["phone", "desktop"]));
    expect(new Set(visualShots().map((shot) => shot.locale))).toEqual(new Set(["en", "ko"]));
    expect(new Set(visualShots().map((shot) => shot.scheme))).toEqual(new Set(["light", "dark", "forced-colors"]));
  });

  it("every registry route, including hidden booking, is pictured or has an exclusion note", () => {
    expect(ROUTES).toHaveLength(38);
    expect(visualRouteProblems(APP_ROUTES)).toEqual([]);
    expect(visualRouteProblems(ROUTES)).toEqual([]);
    for (const nav of ["link", "section", "hidden"]) {
      expect(visualRouteProblems([...ROUTES, { id: "new", path: "/new", sample: "/new", nav }])).toContain(`new: registry route (${nav}) has no visual screen or exclusion note`);
    }
    expect(visualRouteProblems(ROUTES, VISUAL_SCREENS.filter((screen) => screen.screenId !== "inventory"))).toContain("inventory: registry route (link) has no visual screen or exclusion note");
    expect(visualRouteProblems(ROUTES, VISUAL_SCREENS.filter((screen) => screen.screenId !== "booking"))).toContain("booking: registry route (hidden) has no visual screen or exclusion note");
    expect(visualRouteProblems(APP_ROUTES, VISUAL_SCREENS, [{ path: "/dev/gallery", note: "  " }])).toContain("/dev/gallery: exclusion needs a meaningful note");
    expect(visualRouteProblems(APP_ROUTES, VISUAL_SCREENS, [...VISUAL_EXCLUSIONS, ...VISUAL_EXCLUSIONS])).toContain("/dev/gallery: duplicate exclusion");
    expect(visualRouteProblems(ROUTES, [...VISUAL_SCREENS, VISUAL_SCREENS[0]!])).toContain("box-office: duplicate screen id");
    expect(visualRouteProblems(ROUTES, VISUAL_SCREENS, [{path: "/", note: "A conflicting exclusion"}])).toContain("/: both pictured and excluded");
    expect(visualRouteProblems(ROUTES, VISUAL_SCREENS, [{path: "/booking/:eventId", note: "A conflicting dynamic-route exclusion"}])).toContain("/booking/:eventId: both pictured and excluded");
    expect(visualRouteProblems(ROUTES, [{screenId: "wrong", path: "/", matrix: "full"}])).toContain("/: screen id differs from registry id box-office");
    expect(visualRouteProblems(ROUTES, [{screenId: "extra", path: "/extra", matrix: "coverage"}])).toContain("/extra: screen matches no registry sample");
    recordCheck("visual.harness.route-coverage");
  });

  it("receipts masks cover per-load ids in both shots and reject stale targets or leaked ids", async () => {
    const page = await suite.newPage();
    try {
      let previous = "";
      for (const shot of visualShots().filter((item) => item.screenId === "receipts")) {
        await openShot(page, suite.origin, shot);
        expect(await maskProblems(page, "receipts")).toEqual([]);
        const current = (await page.locator(".receipt .section-head").textContent())?.match(/page:[0-9a-f]{16}/)?.[0];
        expect(current).toMatch(/^page:[0-9a-f]{16}$/);
        expect(current).not.toBe(previous);
        previous = current ?? "";
        await suite.quiet(page, `receipts ${shot.viewport} before reload`);
        await openShot(page, suite.origin, shot);
        expect(await maskProblems(page, "receipts")).toEqual([]);
        expect(await page.locator(".receipt .section-head").textContent()).not.toContain(current);
        await suite.quiet(page, `receipts ${shot.viewport} after reload`);
      }
      await page.locator("#receipt-diagnostic").evaluate((el) => { el.id = "missing-mask-target"; });
      expect(await maskProblems(page, "receipts")).toContain("receipts.diagnostic-export: expected 1 targets, found 0");
      await page.locator("#missing-mask-target").evaluate((el) => { el.id = "receipt-diagnostic"; });
      for (const tag of ["p", "input", "textarea"]) {
        await page.evaluate((tagName) => {
          const el = document.createElement(tagName);
          el.id = "leaked-id";
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = "page:0123456789abcdef";
          else el.textContent = "page:0123456789abcdef";
          document.body.append(el);
        }, tag);
        expect(await maskProblems(page, "receipts")).toContain("receipts: unmasked visible session id");
        await page.locator("#leaked-id").evaluate((el) => el.remove());
      }
      expect(await maskProblems(page, "receipts")).toEqual([]);
      await suite.pass(page, "visual.harness.masks");
    } finally { await page.close(); }
  });

  it("the bind doc carries every shot and reviewed mask", () => {
    const doc = fs.readFileSync(new URL("../../../../docs/c-plan-c-visual-baseline-coverage-stub-apps-bind.md", import.meta.url), "utf8");
    for (const shot of visualShots()) expect(doc).toContain(idOf(shot));
    for (const mask of Object.values(VISUAL_MASKS).flat()) {
      expect(doc).toContain(mask.maskId);
      expect(doc).toContain(mask.selector);
    }
    expect(doc).toContain("pixel match on one render profile");
    recordCheck("visual.harness.doc-table");
  });

  it("marketplace Korean protocol field names wrap within the phone viewport", async () => {
    const page = await suite.newPage();
    try {
      await openShot(page, suite.origin, { screenId: "marketplace-performance", path: "/marketplace-performance", viewport: "phone", locale: "ko", scheme: "light" });
      expect(await layoutProblems(page)).toEqual([]);
      const note = page.locator("#mperf-session p").filter({ hasText: "realDeviceEvidence" });
      expect(await note.count()).toBe(1);
      expect(await note.evaluate((el) => ({ wrap: getComputedStyle(el).overflowWrap, width: el.clientWidth, scroll: el.scrollWidth }))).toEqual({wrap: "anywhere", width: 366, scroll: 366});
      // Reproduce the pre-fix defect without changing the production build or weakening the probe.
      await page.locator("#mperf-session").evaluate((el) => { el.style.overflowWrap = "normal"; });
      expect(await layoutProblems(page)).toContain("layout.document-overflow");
      expect(await note.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      await page.locator("#mperf-session").evaluate((el) => { el.style.removeProperty("overflow-wrap"); });
      expect(await layoutProblems(page)).toEqual([]);
      await suite.pass(page, "visual.harness.marketplace-layout");
    } finally { await page.close(); }
  });

  it("identical pictures differ by 0 pixels", async () => {
    const a = await barPng(visual.helper(), 200, 60, 10);
    const b = await barPng(visual.helper(), 200, 60, 10);
    const compared = await comparePngs(visual.helper(), a, b);
    expect(compared).toMatchObject({ sizeMatch: true, diffPixels: 0, diffPng: null });
    expect(passes(compared.diffPixels, 200, 60)).toBe(true);
    recordCheck("visual.harness.identical");
  });

  it("recording preserves exactly equal decoded pixels, but replaces a tolerated channel change", async () => {
    const a = await barPng(visual.helper(), 200, 60, 10);
    const b64 = await visual.helper().evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const pen = canvas.getContext("2d")!;
      pen.drawImage(bitmap, 0, 0);
      const pixels = pen.getImageData(0, 0, canvas.width, canvas.height);
      pixels.data[0] = 254;
      pen.putImageData(pixels, 0, 0);
      return canvas.toDataURL("image/png").split(",")[1]!;
    }, a.toString("base64"));
    const b = Buffer.from(b64, "base64");
    expect(await comparePngs(visual.helper(), a, b)).toMatchObject({ sizeMatch: true, diffPixels: 0, exactPixelsEqual: false });
    const profile = { ...visual.profile(), profile: `test-preservation-${process.pid}` };
    const dir = path.join(new URL("../../visual-baselines/", import.meta.url).pathname, profile.profile);
    const target = path.join(dir, "preserve.png");
    try {
      fs.mkdirSync(dir);
      // Trailing bytes do not alter decoded pixels; keeping them proves no rewrite took place.
      const original = Buffer.concat([a, Buffer.from("encoding-marker")]);
      fs.writeFileSync(target, original);
      expect((await settleShot(visual.helper(), profile, "preserve", a, {KIX_VISUAL_UPDATE: "1"})).result).toBe("MATCH");
      expect(fs.readFileSync(target).equals(original)).toBe(true);
      expect((await settleShot(visual.helper(), profile, "preserve", b, {KIX_VISUAL_UPDATE: "1"})).result).toBe("RECORDED");
      expect(fs.readFileSync(target).equals(b)).toBe(true);
    } finally { fs.rmSync(dir, {recursive: true, force: true}); }
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
        hashes: Object.fromEntries(ids.map((id) => [id, pngHash(picture)])),
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
      writeManifest({ ...manifest, hashes: { ...manifest.hashes, [ids[0]!]: "0".repeat(64) } });
      expect(baselineProblems(root, ids)).toEqual([`linux-0a1b2c3d: ${ids[0]}.png hash differs from the manifest`]);
      writeManifest({ ...manifest, hashes: { ...manifest.hashes, [ids[0]!]: "" } });
      expect(baselineProblems(root, ids)).toEqual([`linux-0a1b2c3d: ${ids[0]}.png hash differs from the manifest`]);
      writeManifest({ ...manifest, hashes: {} });
      expect(baselineProblems(root, ids)).toEqual(["linux-0a1b2c3d: manifest hashes do not list exactly the shot ids"]);
      const tall = await barPng(visual.helper(), 390, MAX_SHOT_HEIGHT + 1, 10);
      fs.writeFileSync(path.join(dir, `${ids[0]}.png`), tall);
      writeManifest({ ...manifest, hashes: { ...manifest.hashes, [ids[0]!]: pngHash(tall) } });
      expect(baselineProblems(root, ids)).toEqual([`linux-0a1b2c3d: ${ids[0]}.png is taller than MAX_SHOT_HEIGHT`]);
      const invalid = Buffer.from("not a png");
      writeManifest({ ...manifest, hashes: { ...manifest.hashes, [ids[0]!]: pngHash(invalid) } });
      fs.writeFileSync(path.join(dir, `${ids[0]}.png`), invalid);
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
      timing: timingFixture(),
      lifecycle: lifecycleFixture(),
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
