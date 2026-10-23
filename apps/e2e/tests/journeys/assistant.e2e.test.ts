import { describe, expect, it } from "vitest";
import { expectText, newDeskPage, nav, poll } from "../../src/desk";
import { attribute, holdNotice, oneAttempt, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("assistant journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Assistant");
        await page.locator("#dlg-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#dlg-request-text").fill("draft an order for lst-0001");
        await page.locator("#dlg-ask").click();
        await page.locator('button[id^="dlg-approve-"]').waitFor();
        await page.locator('button[id^="dlg-approve-"]').click();
        await page.locator('[data-outcome="CONFIRMED"]').waitFor();
        expect(await page.locator("[data-draft]").count()).toBe(1);
        await suite.pass(page, "assistant.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "dlg", "denied");
        await attribute(page, "#dlg-status", "data-delegation-state", "denied");
        await expectText(page, "GRANT_REVOKED");
        await suite.pass(page, "assistant.REJECT");
        await page.close();
    });
    it("UNKNOWN: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "dlg", "draft-lost");
        await page.locator("#dlg-request-text").fill("draft an order for lst-0001");
        await page.locator("#dlg-ask").click();
        await page.locator('button[id^="dlg-approve-"]').waitFor();
        await page.locator('button[id^="dlg-approve-"]').click();
        await page.locator('[data-outcome="UNKNOWN"]').waitFor();
        await expectText(page, "RESPONSE_LOST");
        await suite.pass(page, "assistant.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await holdNotice(page);
        await suite.pass(page, "assistant.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "dlg", "draft-lost");
        await page.locator("#dlg-request-text").fill("draft an order for lst-0001");
        await page.locator("#dlg-ask").click();
        await page.locator('button[id^="dlg-approve-"]').waitFor();
        await oneAttempt(page, suite, page.locator("button[id^=dlg-approve-]"), async () => {
            await poll(() => page.locator("#dlg-session [data-counters]").innerText(), value => /Sent 1\./.test(value), "exactly one send");
        }, async () => {
            await page.locator("#dlg-scenario").waitFor();
            await poll(() => page.locator("#dlg-session [data-counters]").innerText(), value => /Sent 0\./.test(value), "no replay after reload");
        });
        await suite.pass(page, "assistant.one-attempt");
        await page.close();
    });
});
