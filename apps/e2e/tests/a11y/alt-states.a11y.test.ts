import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { A11Y_BASELINE, ALT_STATES, altCheckId, ratchet } from "../../src/a11y-matrix";
import { runAxe } from "../../src/a11y-axe";
import { formProblems, structureProblems, tabTo } from "../../src/a11y-keyboard";
import { recordFacet } from "../../src/a11y-record";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

type Driver = (page: Page) => Promise<string[]>;

/** Focuses a control and presses a key. The control is reached by Tab when it is on the path, by focus() otherwise. */
async function key(page: Page, selector: string, name: string): Promise<void> {
  await page.locator(selector).focus();
  await page.keyboard.press(name);
}

const DRIVERS: Record<string, Driver> = {
  "booking:invalid": async (page) => {
    expect(await tabTo(page, "#booking-quantity")).toBe(true);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("1.5");
    await page.keyboard.press("Enter");
    await page.locator("#booking-error").waitFor();
    expect(await page.locator("#booking-quantity").inputValue(), "the typed value is kept").toBe("1.5");
    return formProblems(page, "booking-quantity");
  },
  "booking:missing": async (page) => {
    await page.getByRole("alert").first().waitFor();
    return [];
  },
  "discovery:empty": async (page) => {
    expect(await tabTo(page, "#discovery-q")).toBe(true);
    await page.locator("#discovery-q").fill("zzzz-no-match");
    await page.locator("p.empty", { hasText: "No matching synthetic rows." }).waitFor();
    return [];
  },
  "discovery:conflict": async (page) => {
    // Re-enter the dates when the conflict does not show: an early fill can land before the controlled inputs are wired.
    // Each attempt waits for the render before it refills, so a late render never has its focus move overwritten.
    let shown = false;
    for (let attempt = 0; attempt < 5 && !shown; attempt += 1) {
      await page.locator("#discovery-from").fill("2026-12-01");
      await page.locator("#discovery-to").fill("2026-01-01");
      shown = await page.locator("#discovery-conflict").waitFor({ timeout: 5_000 }).then(() => true, () => false);
    }
    expect(shown, "the filter conflict is shown").toBe(true);
    return formProblems(page, "discovery-from");
  },
  "organizer-workspace:empty-id": async (page) => {
    await page.locator("#organizer-ws-event-id").fill("");
    await key(page, "button.organizer-ws-button:has-text('Add to change list')", "Enter");
    await key(page, "button.organizer-ws-button:has-text('Prepare preview')", "Enter");
    await page.locator("#organizer-ws-preview-error").waitFor();
    return formProblems(page, "organizer-ws-event-id");
  },
  "gift:not-sent": async (page) => {
    await page.locator("#gift-id").fill("gift_blank");
    await key(page, "button:has-text('Send offer_gift')", "Enter");
    await page.locator("li.journey-step[data-status='not-sent']").first().waitFor();
    return formProblems(page, "gift-ticket-id");
  },
  "inventory:section-page": async (page) => {
    expect(await tabTo(page, "a[href^='/inventory?section=']")).toBe(true);
    await page.keyboard.press("Enter");
    await page.locator("[role=listbox][aria-label='Seats on this page']").waitFor();
    return [];
  },
  "receipts:empty": async (page) => {
    await page.locator("#receipt-timeline p.empty").waitFor();
    return [];
  },
  "journeys:unknown-filter": async (page) => {
    await page.locator("#xs-filter-status").selectOption({ label: "Unknown: unconfirmed" });
    await key(page, "button:has-text('Apply filter')", "Enter");
    await page.locator("table[aria-label='Cross-surface journeys'] tbody tr").first().waitFor();
    return [];
  },
  "session:attach-lost": async (page) => {
    await page.getByLabel("Scenario").selectOption("attach-lost");
    await key(page, "button:has-text('Start new source with this scenario')", "Enter");
    const attach = page.locator("#session-attach-obs-0001");
    await attach.waitFor();
    await page.waitForFunction(() => !(document.getElementById("session-attach-obs-0001") as HTMLButtonElement).disabled);
    await key(page, "#session-attach-obs-0001", "Enter");
    await page.getByTestId("session-status").getByText(/unknown|unconfirmed|lost/i).first().waitFor();
    return [];
  },
};

describe("alternate states the stub reaches today: axe, structure and form probes (desktop)", () => {
  const suite = useBrowser();

  for (const state of ALT_STATES) {
    it(`${state.id}: ${state.label}`, async () => {
      const page = await suite.newPage();
      await openScreen(page, suite.origin, state.path, "desktop");
      const driver = DRIVERS[state.id];
      expect(driver, `a driver for ${state.id}`).toBeDefined();
      const problems = [...(await driver!(page))];
      const axe = await runAxe(page, A11Y_BASELINE.tags);
      problems.push(...axe.violations.map((rule) => rule.ruleId), ...(await structureProblems(page)));
      recordFacet({ kind: "observation", id: `alt.${state.id}`, note: `axe incomplete: ${axe.incomplete.length}` });
      const { unlisted, vanished } = ratchet(state.id, "desktop", problems);
      expect(unlisted, `problems not in KNOWN_FINDINGS in state ${state.id}`).toEqual([]);
      expect(vanished, `OPEN findings that no longer show in state ${state.id}; mark them FIXED`).toEqual([]);
      await suite.pass(page, altCheckId(state.id));
      await page.close();
    });
  }
});
