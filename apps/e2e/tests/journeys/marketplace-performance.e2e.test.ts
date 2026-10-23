import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav, poll } from "../../src/desk";
import { attribute, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("marketplace-performance journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Marketplace bench");
        await page.locator("#mperf-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#mperf-next").click();
        await poll(() => page.locator("#mperf-window [data-sequence]").count(), n => n > 0, "bounded page rows");
        await expectText(page, "SYNTHETIC");
        await suite.pass(page, "marketplace-performance.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "mperf", "claims-price");
        await expectText(page, "refused");
        await expectText(page, "CLAIM");
        await suite.pass(page, "marketplace-performance.REJECT");
        await page.close();
    });
    it("UNKNOWN: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "mperf", "read-lost");
        await attribute(page, "#mperf-status [data-read-state]", "data-read-state", "loading");
        expect(await page.locator("#mperf-window [data-sequence]").count()).toBe(0);
        await expectText(page, "A lost answer stays unknown.");
        await suite.pass(page, "marketplace-performance.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await expectText(page, "Queue admission is browse access to that page only");
        await expectText(page, "never a hold, a payment, an issued right, or entry");
        await expectNoButton(page, /^Send /);
        await expectNoButton(page, BANNED_SEND);
        await suite.pass(page, "marketplace-performance.NOT_BOUND");
        await page.close();
    });
});
