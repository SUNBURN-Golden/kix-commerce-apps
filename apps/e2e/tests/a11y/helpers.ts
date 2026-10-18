import type { Page } from "playwright-core";
import { VIEWPORTS, type ViewportName } from "../../src/a11y-matrix";

/** Opens a path by full load and waits until the main region has content. Full loads reset module-level desk state. */
export async function openScreen(page: Page, origin: string, path: string, viewport: ViewportName = "desktop"): Promise<void> {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(origin + path);
  await page.locator("#desk-main > :not([data-screen-loading])").first().waitFor();
}
