import { expect } from "vitest";
import type { Locator, Page } from "playwright-core";
import { BANNED_SEND, expectNoButton, expectText, poll } from "./desk";
import type { Suite } from "./suite";

/** Uses only controls that ship with the desk; no interception, injected state or fault hook. */
export async function selectScenario(page: Page, prefix: string, value: string): Promise<void> {
  await page.locator("#" + prefix + "-scenario").selectOption(value);
  const apply = page.locator("#" + prefix + "-apply-scenario");
  if (await apply.count()) await apply.click();
  if (await page.locator("header[data-scenario]").count()) {
    await page.locator('[data-scenario="' + value + '"]').first().waitFor();
  }
  await poll(() => page.locator("#" + prefix + "-scenario").inputValue(), actual => actual === value, "scenario applied");
}

export async function attribute(page: Page, selector: string, key: string, value: string): Promise<void> {
  await poll(() => page.locator(selector).getAttribute(key), actual => actual === value, selector + " " + key + "=" + value);
}

export async function holdNotice(page: Page): Promise<void> {
  const hold = page.locator('[data-hold-record="not-bound"]').first();
  await hold.waitFor();
  expect(await hold.getAttribute("data-hold-record")).toBe("not-bound");
  const text = await hold.innerText();
  for (const word of ["placeHold", "reserve_listing"]) expect(text).toContain(word);
  await expectNoButton(page, BANNED_SEND);
}

/**
 * Three real input triggers on one logical send. The assertion reads an existing
 * attempt counter/operation row, not a stubbed event or a network interception.
 * Verify before reload because page-load records deliberately clear on reload.
 */
export async function oneAttempt(
  page: Page, suite: Suite, button: Locator,
  assertOnce: () => Promise<void>, assertAfterReload: () => Promise<void>,
): Promise<void> {
  await button.dblclick();
  await assertOnce();
  expect(await button.isDisabled() || await button.getAttribute("aria-disabled") === "true", "send must lock").toBe(true);
  await button.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await assertOnce();
  await suite.quiet(page, "one-attempt before reload");
  await page.reload();
  await assertAfterReload();
  await expectText(page, "Adapter stub. Environment stub.");
}
