import { beforeAll, expect } from "vitest";
import type { Page } from "playwright-core";
import type { Suite } from "../../src/suite";
import { layoutProblems, maskProblems, openShot, renderProfile, settleShot, takeShot, type RenderProfile } from "../../src/visual-compare";
import { idOf, visualCheckId, type VisualShot } from "../../src/visual-matrix";
import { recordShot } from "../../src/visual-record";

export interface VisualContext {
  /** A page that loads nothing. The comparator and the profile probe run inside it. */
  helper: () => Page;
  profile: () => RenderProfile;
}

/** Opens the helper page and measures the render profile once per file, after the browser is open. */
export function useVisual(suite: Suite): VisualContext {
  let helper: Page | null = null;
  let profile: RenderProfile | null = null;
  beforeAll(async () => {
    helper = await suite.newPage();
    profile = await renderProfile(helper, suite.session().version);
  });
  return {
    helper: () => {
      if (!helper) {
        throw new Error("The helper page is not open.");
      }
      return helper;
    },
    profile: () => {
      if (!profile) {
        throw new Error("The render profile is not measured.");
      }
      return profile;
    },
  };
}

/** Opens one shot, checks the layout probes, takes the picture, compares or records it, and records the check. */
export async function checkShot(suite: Suite, visual: VisualContext, shot: VisualShot): Promise<void> {
  const id = idOf(shot);
  const page = await suite.newPage();
  try {
    await openShot(page, suite.origin, shot);
    expect(await layoutProblems(page), `${id} layout`).toEqual([]);
    expect(await maskProblems(page, shot.screenId), `${id} masks`).toEqual([]);
    const picture = await takeShot(page, shot);
    const result = await settleShot(visual.helper(), visual.profile(), id, picture);
    recordShot({ ...result, render: visual.profile() });
    await suite.pass(page, visualCheckId(id));
  } finally {
    await page.close();
  }
}
