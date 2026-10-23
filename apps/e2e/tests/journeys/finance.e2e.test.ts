import { describe, it } from "vitest";
import { expectText, newDeskPage, nav, poll } from "../../src/desk";
import { attribute, holdNotice, oneAttempt, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("finance journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Finance");
        await page.locator("#finance-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#finance-propose-rcs-0001-link-observation").click();
        await attribute(page, "[data-last-request]", "data-phase", "applied");
        await page.locator("#finance-refresh").click();
        await page.locator("#finance-actor").selectOption("finance-approver");
        await page.locator("#finance-apply-actor").click();
        await page.locator("#finance-approve-prp-0001").click();
        await attribute(page, "[data-last-request]", "data-phase", "applied");
        await suite.pass(page, "finance.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "finance", "self-approval");
        await page.locator("#finance-actor").selectOption("finance-approver");
        await page.locator("#finance-apply-actor").click();
        await page.locator("#finance-approve-prp-0001").click();
        await attribute(page, "[data-last-request]", "data-phase", "rejected");
        await expectText(page, "SELF_APPROVAL");
        await suite.pass(page, "finance.REJECT");
        await page.close();
    });
    it("UNKNOWN: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "finance", "act-lost");
        await page.locator("#finance-propose-rcs-0001-link-observation").click();
        await attribute(page, "[data-last-request]", "data-phase", "unknown");
        await expectText(page, "unknown");
        await suite.pass(page, "finance.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await holdNotice(page);
        await suite.pass(page, "finance.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "finance", "act-lost");
        await oneAttempt(page, suite, page.locator("#finance-propose-rcs-0001-link-observation"), async () => {
            await poll(() => page.locator("#finance-session [data-counters]").innerText(), value => /Requests 1\./.test(value), "exactly one send");
        }, async () => {
            await page.locator("#finance-scenario").waitFor();
            await poll(() => page.locator("#finance-session [data-counters]").innerText(), value => /Requests 0\./.test(value), "no replay after reload");
        });
        await suite.pass(page, "finance.one-attempt");
        await page.close();
    });
});
