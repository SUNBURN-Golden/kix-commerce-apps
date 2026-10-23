import { describe, it } from "vitest";
import { expectText, newDeskPage, nav, poll } from "../../src/desk";
import { attribute, holdNotice, oneAttempt, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("credit-servicing journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Credit servicing");
        await page.locator("#servicing-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#servicing-propose-adjustment").click();
        await attribute(page, "[data-last-request]", "data-phase", "applied");
        await page.locator("#servicing-refresh").click();
        await page.locator("#servicing-switch-actor").click();
        await page.locator("#servicing-refresh").click();
        await page.locator("#servicing-approve-prp-0002").click();
        await attribute(page, "[data-last-request]", "data-phase", "applied");
        await suite.pass(page, "credit-servicing.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "servicing", "denied");
        await attribute(page, "#servicing-status", "data-servicing-state", "denied");
        await expectText(page, "GRANT_REVOKED");
        await suite.pass(page, "credit-servicing.REJECT");
        await page.close();
    });
    it("UNKNOWN: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "servicing", "act-lost");
        await page.locator("#servicing-propose-adjustment").click();
        await attribute(page, "[data-last-request]", "data-phase", "unknown");
        await expectText(page, "unknown");
        await suite.pass(page, "credit-servicing.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await holdNotice(page);
        await suite.pass(page, "credit-servicing.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "servicing", "act-lost");
        await oneAttempt(page, suite, page.locator("#servicing-propose-adjustment"), async () => {
            await poll(() => page.locator("#servicing-session [data-counters]").innerText(), value => /Requests 1\./.test(value), "exactly one send");
        }, async () => {
            await page.locator("#servicing-scenario").waitFor();
            await poll(() => page.locator("#servicing-session [data-counters]").innerText(), value => /Requests 0\./.test(value), "no replay after reload");
        });
        await suite.pass(page, "credit-servicing.one-attempt");
        await page.close();
    });
});
