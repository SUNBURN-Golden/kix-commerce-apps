import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav } from "../../src/desk";
import { selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("journeys journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Journeys");
        await page.locator("#xs-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#xs-filter-journey").selectOption("purchase-booking");
        await page.locator("#xs-apply-filter").click();
        expect(await page.locator('table[aria-label="Cross-surface journeys"] tbody tr').count()).toBeGreaterThan(0);
        await expectText(page, "Purchase: booking");
        await suite.pass(page, "journeys.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "xs", "claims-pass");
        await expectText(page, "refused");
        await suite.pass(page, "journeys.REJECT");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await expectText(page, "placeHold is not-bound.");
        await expectText(page, "reserve_listing");
        await expectText(page, "COMPENSATION_UNDEFINED");
        await expectNoButton(page, BANNED_SEND);
        await suite.pass(page, "journeys.NOT_BOUND");
        await page.close();
    });
});
