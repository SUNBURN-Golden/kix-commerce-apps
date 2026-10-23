import { describe, it } from "vitest";
import { expectText, newDeskPage, nav, poll } from "../../src/desk";
import { attribute, holdNotice, oneAttempt, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("credit-origination journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Credit origination");
        await page.locator("#origination-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#origination-submit").click();
        await attribute(page, "[data-last-request]", "data-phase", "applied");
        await expectText(page, "Nothing is disbursed.");
        await suite.pass(page, "credit-origination.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "origination", "limit-race");
        await page.locator("#origination-drawdown").click();
        await attribute(page, "[data-last-request]", "data-phase", "rejected");
        await expectText(page, "LIMIT_TAKEN");
        await suite.pass(page, "credit-origination.REJECT");
        await page.close();
    });
    it("UNKNOWN: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "origination", "act-lost");
        await page.locator("#origination-submit").click();
        await attribute(page, "[data-last-request]", "data-phase", "unknown");
        await expectText(page, "unknown");
        await suite.pass(page, "credit-origination.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await holdNotice(page);
        await suite.pass(page, "credit-origination.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "origination", "act-lost");
        await oneAttempt(page, suite, page.locator("#origination-submit"), async () => {
            await poll(() => page.locator("#origination-session [data-counters]").innerText(), value => /Requests 1\./.test(value), "exactly one send");
        }, async () => {
            await page.locator("#origination-scenario").waitFor();
            await poll(() => page.locator("#origination-session [data-counters]").innerText(), value => /Requests 0\./.test(value), "no replay after reload");
        });
        await suite.pass(page, "credit-origination.one-attempt");
        await page.close();
    });
});
