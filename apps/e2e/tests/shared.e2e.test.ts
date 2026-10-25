import { describe, expect, it } from "vitest";
import { expectText, newDeskPage, nav, poll, press } from "../src/desk";
import { useBrowser } from "../src/suite";

const TABLE_JOURNEYS: [string, string][] = [
  ["booking", "Purchase: booking"],
  ["resale", "Resale: platform trade"],
  ["gift", "Gift"],
  ["organizer", "Organizer"],
];

describe("shared UNKNOWN evidence (stub, headless Chrome)", () => {
  const suite = useBrowser();

  async function openJourneys() {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await nav(page, "Journeys");
    await page.getByRole("table", { name: "Cross-surface journeys" }).waitFor();
    return page;
  }

  for (const [key, label] of TABLE_JOURNEYS) {
    it(`journeys table: the ${key} Response lost branch is a reused reference row, fenced or undefined, and never closed`, async () => {
      const page = await openJourneys();
      await page.locator("#xs-filter-journey").selectOption({ label });
      await page.locator("#xs-filter-branch").selectOption({ label: "Response lost" });
      await press(page, "Apply filter");
      const rows = page.locator("table[aria-label='Cross-surface journeys'] tbody tr");
      await poll(() => rows.count(), (count) => count >= 1, `${key} Response lost rows`);
      const texts = (await rows.allTextContents()).map((text) => text.replace(/\s+/g, " "));
      for (const text of texts) {
        expect(text).toMatch(/pointer: not run here|reused from an existing run or test/i);
        expect(text).toMatch(/FENCED|COMPENSATION_UNDEFINED/);
        expect(text).not.toMatch(/closed on the whole sequence/i);
      }
      await suite.pass(page, `journeys-table.RESPONSE_LOST.${key}`);
      await page.close();
    });
  }

  it("journeys page: the table reads once, closes nothing on its own, and names the three compensation words", async () => {
    const page = await openJourneys();
    await expectText(page, "A table read is one request and is made once.");
    await expectText(page, "Environment stub.");
    await expectText(page, "COMPENSATION_UNDEFINED");
    await expectText(page, "not counted as closed");
    // The Unknown rows that do exist belong to other surfaces. They are listed, never closed.
    await page.locator("#xs-filter-status").selectOption({ label: "Unknown: unconfirmed" });
    await press(page, "Apply filter");
    const unknown = page.locator("table[aria-label='Cross-surface journeys'] tbody tr");
    await poll(() => unknown.count(), (count) => count >= 1, "Unknown rows");
    for (const text of await unknown.allTextContents()) {
      expect(text).toMatch(/unknown/i);
      expect(text).not.toMatch(/closed on the whole sequence/i);
      expect(text).toMatch(/unknown-outcome/);
    }
    await suite.pass(page, "journeys-page.UNKNOWN");
    await page.close();
  });

  it("session: after an attach whose answer is lost, a reload shows the intent as unknown and sends nothing new", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await nav(page, "Session recovery");
    await page.getByRole("heading", { name: "Session recovery (synthetic)" }).waitFor();
    await page.getByLabel("Scenario").selectOption("attach-lost");
    await press(page, "Start new source with this scenario");
    const attach = page.locator("#session-attach-obs-0001");
    await poll(() => attach.isEnabled(), (enabled) => enabled, "attach enabled");
    await attach.click();
    const status = page.getByTestId("session-status");
    const before = (await status.textContent()) ?? "";
    expect(before).toMatch(/unknown|unconfirmed|lost/i);
    await suite.quiet(page, "session before reload");
    await press(page, "Reload this page");
    await page.getByRole("heading", { name: "Session recovery (synthetic)" }).waitFor();
    await poll(
      async () => (await page.getByTestId("session-status").textContent()) ?? "",
      (text) => /came back as UNKNOWN/.test(text),
      "an unsettled write recovered as UNKNOWN after reload",
    );
    const after = (await page.getByTestId("session-status").textContent()) ?? "";
    expect(after).toMatch(/Nothing was sent again/);
    expect(after).toMatch(/Sent 0 in this load/);
    await expectText(page, "Retention is UNDETERMINED.");
    await suite.pass(page, "session.UNKNOWN");
    await page.close();
  });
  it("back/forward restores a filter and selected row on notifications and finance", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    for (const [route, filter, selection] of [["/notifications", "filter", "item"], ["/finance", "queue", "case"]]) {
      await page.goto(`${suite.origin}${route}`);
      const select = page.locator(`#read-${filter}`);
      await select.waitFor();
      await poll(() => select.locator("option").count(), (count) => count > 2, `${route} filter options`);
      const options = await select.locator('option:not([value=""])').evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
      // unread is the initial notification source; finance uses the first real category.
      const first = route === "/notifications" ? "unread" : options[0]!;
      const second = route === "/notifications" ? "all" : options[1]!;
      await select.selectOption(first);
      await page.locator(`#read-apply-${filter}`).click();
      await poll(() => Promise.resolve(new URL(page.url()).searchParams.get(filter)), (value) => value === first, "first filter pushed");
      const choice = page.locator(`[data-read-choice="${selection}"]`).first();
      await choice.waitFor();
      const id = await choice.getAttribute("data-read-value");
      await choice.click();
      await poll(() => Promise.resolve(new URL(page.url()).searchParams.get(selection)), (value) => value === id, "selection replaced");
      const selectedText = await page.locator('[data-read-selected="true"]').textContent();
      await page.reload();
      await page.locator(`[data-read-selected="true"][data-read-id="${id}"]`).waitFor();
      expect(await page.locator('[data-read-selected="true"]').textContent()).toBe(selectedText);
      await select.selectOption(second);
      await page.locator(`#read-apply-${filter}`).click();
      await poll(() => Promise.resolve(new URL(page.url()).searchParams.get(filter)), (value) => value === second, "second filter pushed");
      await poll(() => page.locator('[data-read-selected="true"]').count(), (count) => count === 0, "selection cleared with filter");
      await page.goBack();
      await poll(() => select.inputValue(), (value) => value === first, "back restores filter");
      await page.locator(`[data-read-selected="true"][data-read-id="${id}"]`).waitFor();
      expect(await page.locator('[data-read-selected="true"]').textContent()).toBe(selectedText);
      await page.goForward();
      await poll(() => select.inputValue(), (value) => value === second, "forward restores filter");
      await poll(() => page.locator('[data-read-selected="true"]').count(), (count) => count === 0, "selection cleared with filter");
    }
    await suite.pass(page, "back-forward.read-state");
    await page.close();
  });

});
