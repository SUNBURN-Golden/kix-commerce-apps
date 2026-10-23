import { describe, expect, it } from "vitest";
import { expectText, newDeskPage, nav } from "../../src/desk";
import { attribute, holdNotice, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("merchant journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Merchant");
        await page.locator("#merchant-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#merchant-export").click();
        await attribute(page, "#merchant-export-panel", "data-export-phase", "loaded");
        expect(await page.locator("[data-export-row]").count()).toBeGreaterThan(0);
        await suite.pass(page, "merchant.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "merchant", "denied");
        await attribute(page, "#merchant-status", "data-merchant-state", "denied");
        await expectText(page, "GRANT_REVOKED");
        await suite.pass(page, "merchant.REJECT");
        await page.close();
    });
    it("UNKNOWN: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "merchant", "read-lost");
        await attribute(page, "#merchant-status", "data-merchant-state", "unavailable");
        await expectText(page, "The source did not answer. This is not an empty ledger.");
        await suite.pass(page, "merchant.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await holdNotice(page);
        await suite.pass(page, "merchant.NOT_BOUND");
        await page.close();
    });
});
