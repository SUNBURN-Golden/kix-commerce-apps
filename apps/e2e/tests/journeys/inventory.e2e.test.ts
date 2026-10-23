import { describe, expect, it } from "vitest";
import { expectText, newDeskPage, nav } from "../../src/desk";
import { holdNotice, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("inventory journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Seats and GA");
        await page.locator("#inventory-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator('a[href^="/inventory?section="]').first().click();
        const list = page.locator("#inventory-page [role=listbox]");
        await list.focus();
        await page.keyboard.press("Enter");
        await page.locator('[data-selected="true"]').waitFor();
        await expectText(page, "local");
        await suite.pass(page, "inventory.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "inventory", "queue-lapsed");
        await page.locator('[data-queue-state="lapsed"]').waitFor();
        await expectText(page, "no published command to join");
        expect(await page.locator('#inventory-selection [data-selected="true"]').count()).toBe(0);
        await suite.pass(page, "inventory.REJECT");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await holdNotice(page);
        await suite.pass(page, "inventory.NOT_BOUND");
        await page.close();
    });
});
