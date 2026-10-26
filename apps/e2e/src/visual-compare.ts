import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright-core";
import { overflowProblems } from "./a11y-keyboard";
import { FIXED_TIME_ISO, MAX_SHOT_HEIGHT, TOLERANCE, VISUAL_MASKS, VISUAL_MASK_COLOR, VISUAL_VIEWPORTS, type VisualShot } from "./visual-matrix";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Committed baselines: `visual-baselines/<profile>/<shot id>.png` plus one `manifest.json` per profile. */
export const BASELINE_ROOT = path.resolve(here, "../visual-baselines");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height from the PNG header. Throws when the bytes are not a PNG. */
export function pngSize(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a PNG file.");
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export interface PixelComparison {
  actual: { width: number; height: number };
  expected: { width: number; height: number };
  sizeMatch: boolean;
  /** Exact decoded RGBA equality; distinct from the normal RGB tolerance. */
  exactPixelsEqual: boolean;
  diffPixels: number;
  /** A PNG with the differing pixels in red over a dimmed copy of the baseline. Only when pixels differ. */
  diffPng: Buffer | null;
}

/**
 * Compares two PNGs inside the browser that is already open: decode with createImageBitmap, read the pixels from a canvas.
 * No image library is needed. `helper` must be a page that loads nothing (about:blank).
 */
export async function comparePngs(helper: Page, actual: Buffer, expected: Buffer): Promise<PixelComparison> {
  const out = await helper.evaluate(
    async ({ a, b, channelDelta }) => {
      const read = async (base64: string) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }), { colorSpaceConversion: "none" });
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          throw new Error("No 2d canvas.");
        }
        context.drawImage(bitmap, 0, 0);
        return { width: bitmap.width, height: bitmap.height, data: context.getImageData(0, 0, bitmap.width, bitmap.height).data };
      };
      const left = await read(a);
      const right = await read(b);
      const sizeMatch = left.width === right.width && left.height === right.height;
      if (!sizeMatch) {
        return { actual: { width: left.width, height: left.height }, expected: { width: right.width, height: right.height }, sizeMatch, exactPixelsEqual: false, diffPixels: 0, diffPng: null as string | null };
      }
      const exactPixelsEqual = left.data.every((value, index) => value === right.data[index]);
      const diff = new ImageData(left.width, left.height);
      let diffPixels = 0;
      for (let i = 0; i < left.data.length; i += 4) {
        const delta = Math.max(
          Math.abs((left.data[i] ?? 0) - (right.data[i] ?? 0)),
          Math.abs((left.data[i + 1] ?? 0) - (right.data[i + 1] ?? 0)),
          Math.abs((left.data[i + 2] ?? 0) - (right.data[i + 2] ?? 0)),
        );
        const dim = 255 - Math.round((255 - (right.data[i] ?? 0)) * 0.25);
        if (delta > channelDelta) {
          diffPixels += 1;
          diff.data[i] = 255;
          diff.data[i + 1] = 0;
          diff.data[i + 2] = 0;
        } else {
          diff.data[i] = dim;
          diff.data[i + 1] = dim;
          diff.data[i + 2] = dim;
        }
        diff.data[i + 3] = 255;
      }
      let diffPng: string | null = null;
      if (diffPixels > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = left.width;
        canvas.height = left.height;
        canvas.getContext("2d")?.putImageData(diff, 0, 0);
        diffPng = canvas.toDataURL("image/png").split(",")[1] ?? null;
      }
      return { actual: { width: left.width, height: left.height }, expected: { width: right.width, height: right.height }, sizeMatch, exactPixelsEqual, diffPixels, diffPng };
    },
    { a: actual.toString("base64"), b: expected.toString("base64"), channelDelta: TOLERANCE.channelDelta },
  );
  return { ...out, diffPng: out.diffPng ? Buffer.from(out.diffPng, "base64") : null };
}

/** A white picture with a black bar 40px wide and 10px tall at `barX`. Self-check material for the comparator. */
export async function barPng(helper: Page, width: number, height: number, barX: number): Promise<Buffer> {
  const base64 = await helper.evaluate(
    ({ w, h, x }) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("No 2d canvas.");
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, w, h);
      context.fillStyle = "#000000";
      context.fillRect(x, 20, 40, 10);
      return canvas.toDataURL("image/png").split(",")[1] ?? "";
    },
    { w: width, h: height, x: barX },
  );
  return Buffer.from(base64, "base64");
}

export const passes = (diffPixels: number, width: number, height: number): boolean => diffPixels * 1_000_000 <= TOLERANCE.maxDiffPpm * width * height;

/** Differing pixels as whole parts per million of the picture. An integer, so a record never holds a long decimal. */
export const diffPpm = (diffPixels: number, width: number, height: number): number => Math.round((diffPixels * 1_000_000) / (width * height));

export interface RenderProfile {
  /** `<platform>-<8 hex of the font fingerprint>`. The Chrome version is not part of it. */
  profile: string;
  platform: string;
  chrome: string;
  /** Text widths at 16px for a Latin and a Korean string in the three stacks styles.css declares. */
  fontWidths: Record<string, string>;
  /** Whether the Korean glyphs are drawn or the runner shows placeholder boxes. */
  cjkGlyphs: "present" | "missing";
}

const STACKS = [
  '"Avenir Next","Segoe UI",sans-serif',
  'Palatino,"Iowan Old Style",Georgia,serif',
  "Palatino,Georgia,serif",
] as const;
const LATIN = "Box office 0123456789";
const KOREAN = "박스오피스 영수증 가나다";

/** Measures how this browser resolves the fonts the stylesheet names. Baselines are bound to the result. */
export async function renderProfile(helper: Page, chrome: string): Promise<RenderProfile> {
  const probe = await helper.evaluate(
    ({ stacks, latin, korean }) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("No 2d canvas.");
      }
      const widths: Record<string, string> = {};
      stacks.forEach((stack, index) => {
        context.font = `16px ${stack}`;
        widths[`stack${index}.latin`] = context.measureText(latin).width.toFixed(2);
        widths[`stack${index}.korean`] = context.measureText(korean).width.toFixed(2);
      });
      // Three different Hangul syllables must draw three different pictures. Placeholder boxes draw the same one.
      const drawn = new Set<string>();
      for (const glyph of ["가", "힣", "뷁"]) {
        const paper = document.createElement("canvas");
        paper.width = 48;
        paper.height = 48;
        const pen = paper.getContext("2d");
        if (!pen) {
          throw new Error("No 2d canvas.");
        }
        pen.fillStyle = "#ffffff";
        pen.fillRect(0, 0, 48, 48);
        pen.fillStyle = "#000000";
        pen.font = `32px ${stacks[0]}`;
        pen.fillText(glyph, 4, 36);
        drawn.add(paper.toDataURL());
      }
      return { widths, distinct: drawn.size };
    },
    { stacks: [...STACKS], latin: LATIN, korean: KOREAN },
  );
  const fontHash = crypto.createHash("sha256").update(JSON.stringify(probe.widths)).digest("hex").slice(0, 8);
  const platform = process.platform;
  return { profile: `${platform}-${fontHash}`, platform, chrome, fontWidths: probe.widths, cjkGlyphs: probe.distinct === 3 ? "present" : "missing" };
}

export interface BaselineManifest {
  profile: string;
  platform: string;
  chrome: string;
  fontWidths: Record<string, string>;
  cjkGlyphs: "present" | "missing";
  tolerance: { channelDelta: number; maxDiffPpm: number };
  appHead: string;
  recordedOn: string;
  shots: number;
  hashes: Record<string, string>;
}

export const pngHash = (bytes: Buffer): string => crypto.createHash("sha256").update(bytes).digest("hex");

export const profileDir = (profile: string, root: string = BASELINE_ROOT): string => path.join(root, profile);

export function presentProfiles(root: string = BASELINE_ROOT): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Recording a baseline is a local act. It is refused when `CI` is set, and it never counts as the pass evidence. */
export function assertUpdateAllowed(env: NodeJS.ProcessEnv): void {
  if (env.KIX_VISUAL_UPDATE === "1" && env.CI) {
    throw new Error("KIX_VISUAL_UPDATE=1 is refused when CI is set. Baselines are recorded on a machine, reviewed by eye, and committed.");
  }
}

export const isUpdate = (env: NodeJS.ProcessEnv = process.env): boolean => env.KIX_VISUAL_UPDATE === "1";

function outDir(env: NodeJS.ProcessEnv): string | null {
  const dir = env.KIX_VISUAL_OUT;
  if (!dir) {
    return null;
  }
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export interface ShotResult {
  id: string;
  width: number;
  height: number;
  diffPixels: number;
  diffPpm: number;
  result: "MATCH" | "RECORDED";
}

/**
 * Compares one screenshot with its baseline, or records it in update mode. On any failure the actual picture
 * (and the diff) goes to KIX_VISUAL_OUT, so a baseline for a new profile can be taken from the run and reviewed.
 */
export async function settleShot(helper: Page, profile: RenderProfile, id: string, actual: Buffer, env: NodeJS.ProcessEnv = process.env): Promise<ShotResult> {
  assertUpdateAllowed(env);
  const size = pngSize(actual);
  const dir = profileDir(profile.profile);
  const target = path.join(dir, `${id}.png`);
  if (isUpdate(env)) {
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(target) && (await comparePngs(helper, actual, fs.readFileSync(target))).exactPixelsEqual) {
      return { id, ...size, diffPixels: 0, diffPpm: 0, result: "MATCH" };
    }
    fs.writeFileSync(target, actual);
    return { id, ...size, diffPixels: 0, diffPpm: 0, result: "RECORDED" };
  }
  const out = outDir(env);
  const keep = (name: string, bytes: Buffer): void => {
    if (out) {
      fs.writeFileSync(path.join(out, name), bytes);
    }
  };
  const where = out ? `The actual picture is in ${out}.` : "Set KIX_VISUAL_OUT to a directory to receive the actual picture.";
  if (!fs.existsSync(dir)) {
    keep(`${id}.actual.png`, actual);
    if (out) {
      const draft = { profile: profile.profile, platform: profile.platform, chrome: profile.chrome, fontWidths: profile.fontWidths, cjkGlyphs: profile.cjkGlyphs, tolerance: TOLERANCE };
      fs.writeFileSync(path.join(out, "manifest.draft.json"), JSON.stringify(draft, null, 2) + "\n");
    }
    throw new Error(
      `No baseline for render profile ${profile.profile}. Present profiles: ${presentProfiles().join(", ") || "none"}. ` +
        `Record this one on this machine: KIX_VISUAL_UPDATE=1 npm run test:visual, look at every picture, then commit visual-baselines/${profile.profile}/. ${where}`,
    );
  }
  if (!fs.existsSync(target)) {
    keep(`${id}.actual.png`, actual);
    throw new Error(`No baseline file for ${id} in profile ${profile.profile}. ${where}`);
  }
  const expected = fs.readFileSync(target);
  const compared = await comparePngs(helper, actual, expected);
  if (!compared.sizeMatch) {
    keep(`${id}.actual.png`, actual);
    throw new Error(
      `${id}: picture is ${compared.actual.width}x${compared.actual.height}, baseline is ${compared.expected.width}x${compared.expected.height}. A size change is always a failure. ${where}`,
    );
  }
  const ppm = diffPpm(compared.diffPixels, size.width, size.height);
  if (!passes(compared.diffPixels, size.width, size.height)) {
    keep(`${id}.actual.png`, actual);
    if (compared.diffPng) {
      keep(`${id}.diff.png`, compared.diffPng);
    }
    throw new Error(`${id}: ${compared.diffPixels} pixels differ (${ppm} ppm, allowed ${TOLERANCE.maxDiffPpm} ppm). ${where}`);
  }
  return { id, ...size, diffPixels: compared.diffPixels, diffPpm: ppm, result: "MATCH" };
}

/** Everything a committed baseline set must satisfy: exactly the shot ids, valid PNGs, and a manifest per profile that states this tolerance. */
export function baselineProblems(root: string, ids: readonly string[]): string[] {
  const problems: string[] = [];
  const profiles = presentProfiles(root);
  if (profiles.length === 0) {
    return ["no baseline profile is committed"];
  }
  const widths = new Set<number>(Object.values(VISUAL_VIEWPORTS).map((viewport) => viewport.width));
  for (const profile of profiles) {
    const dir = path.join(root, profile);
    const files = fs.readdirSync(dir);
    const pngs = files.filter((name) => name.endsWith(".png"));
    for (const name of files) {
      if (name !== "manifest.json" && !name.endsWith(".png")) {
        problems.push(`${profile}: unexpected file ${name}`);
      }
    }
    for (const name of pngs) {
      if (!ids.includes(name.slice(0, -4))) {
        problems.push(`${profile}: baseline matches no shot: ${name}`);
        continue;
      }
      try {
        const size = pngSize(fs.readFileSync(path.join(dir, name)));
        if (size.height > MAX_SHOT_HEIGHT) problems.push(`${profile}: ${name} is taller than MAX_SHOT_HEIGHT`);
        if (!widths.has(size.width) || size.height < 1) {
          problems.push(`${profile}: ${name} is ${size.width}x${size.height}`);
        }
      } catch {
        problems.push(`${profile}: ${name} is not a PNG`);
      }
    }
    for (const id of ids) {
      if (!pngs.includes(`${id}.png`)) {
        problems.push(`${profile}: missing baseline ${id}.png`);
      }
    }
    const manifestFile = path.join(dir, "manifest.json");
    if (!fs.existsSync(manifestFile)) {
      problems.push(`${profile}: manifest.json is missing`);
      continue;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as Partial<BaselineManifest>;
    if (!manifest.hashes || JSON.stringify(Object.keys(manifest.hashes).sort()) !== JSON.stringify([...ids].sort())) {
      problems.push(`${profile}: manifest hashes do not list exactly the shot ids`);
    }
    for (const id of ids) {
      const file = path.join(dir, `${id}.png`);
      if (fs.existsSync(file) && manifest.hashes && Object.hasOwn(manifest.hashes, id) && pngHash(fs.readFileSync(file)) !== manifest.hashes[id]) {
        problems.push(`${profile}: ${id}.png hash differs from the manifest`);
      }
    }
    if (manifest.profile !== profile) {
      problems.push(`${profile}: manifest names profile ${String(manifest.profile)}`);
    }
    if (JSON.stringify(manifest.tolerance) !== JSON.stringify(TOLERANCE)) {
      problems.push(`${profile}: manifest tolerance differs from the matrix tolerance`);
    }
    if (manifest.cjkGlyphs !== "present" && manifest.cjkGlyphs !== "missing") {
      problems.push(`${profile}: manifest has no cjkGlyphs value`);
    }
    if (manifest.shots !== ids.length) {
      problems.push(`${profile}: manifest counts ${String(manifest.shots)} shots, the matrix has ${ids.length}`);
    }
  }
  return problems;
}

/** Overflow probe for one open shot: a sideways-scrolling document, or a box that pokes out of the window outside a scroll or clip container. */
export async function layoutProblems(page: Page): Promise<string[]> {
  const problems = await overflowProblems(page, "layout.document-overflow");
  const stray = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const main = document.getElementById("desk-main");
    const found: string[] = [];
    main?.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) {
        return;
      }
      for (let up: HTMLElement | null = el; up && up !== main; up = up.parentElement) {
        const style = getComputedStyle(up);
        if (style.overflowX !== "visible" || style.display === "none") {
          return;
        }
      }
      if (rect.right > limit + 1 || rect.left < -1) {
        found.push(el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""));
      }
    });
    return found.slice(0, 5);
  });
  return stray.length > 0 ? [...problems, `layout.outside-window: ${stray.join(", ")}`] : problems;
}

/** Opens a shot the same way every time: pinned clock, media features and viewport, then a full load and a settled page. */
export async function openShot(page: Page, origin: string, shot: VisualShot): Promise<void> {
  await page.setViewportSize(VISUAL_VIEWPORTS[shot.viewport]);
  await page.emulateMedia({
    colorScheme: shot.scheme === "dark" ? "dark" : "light",
    forcedColors: shot.scheme === "forced-colors" ? "active" : "none",
    reducedMotion: "reduce",
  });
  await page.clock.setFixedTime(new Date(FIXED_TIME_ISO));
  const separator = shot.path.includes("?") ? "&" : "?";
  await page.goto(`${origin}${shot.path}${separator}lang=${shot.locale}`);
  await page.locator("#desk-main > :not([data-screen-loading])").first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.waitForLoadState("networkidle");
}

/** The top of the page: full width, at most MAX_SHOT_HEIGHT tall. */
export async function takeShot(page: Page, shot: VisualShot): Promise<Buffer> {
  const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) }));
  const clip = { x: 0, y: 0, width: size.width, height: Math.min(size.height, MAX_SHOT_HEIGHT) };
  const mask = (VISUAL_MASKS[shot.screenId] ?? []).map((spec) => maskLocator(page, spec));
  return page.screenshot({ mask, maskColor: VISUAL_MASK_COLOR, fullPage: true, clip, animations: "disabled", caret: "hide", scale: "css", type: "png" });
}

function maskLocator(page: Page, mask: { selector: string; hasText?: string }) {
  const locator = page.locator(mask.selector);
  return mask.hasText ? locator.filter({ hasText: new RegExp(mask.hasText) }) : locator;
}

/** Refuse stale mask selectors and any visible per-load id outside the reviewed regions. */
export async function maskProblems(page: Page, screenId: string): Promise<string[]> {
  const masks = VISUAL_MASKS[screenId] ?? [];
  const problems: string[] = [];
  for (const mask of masks) {
    const count = await maskLocator(page, mask).count();
    if (count !== mask.count) problems.push(`${mask.maskId}: expected ${mask.count} targets, found ${count}`);
  }
  const leaked = await page.evaluate((specs) => {
    const targets = specs.flatMap((spec) => Array.from(document.querySelectorAll(spec.selector)).filter((el) => !spec.hasText || new RegExp(spec.hasText).test(el.textContent ?? "")));
    const unmasked = (el: Element) => !targets.some((target) => target.contains(el));
    const visible = (el: Element) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const id = /page:[0-9a-f]{16}/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent && !parent.closest("script,style") && visible(parent) && unmasked(parent) && id.test(node.textContent ?? "")) return true;
    }
    return Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea")).some((el) => visible(el) && unmasked(el) && id.test(el.value));
  }, [...masks]);
  if (leaked) problems.push(`${screenId}: unmasked visible session id`);
  return problems;
}
