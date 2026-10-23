import { describe, expect, it } from "vitest";
import { expectText, newDeskPage, nav, poll } from "../../src/desk";
import { holdNotice, oneAttempt, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("mobile journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Mobile shell");
        await page.locator("#mobile-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#mobile-confirm-ord-0001").click();
        await page.locator('[data-outcome="CONFIRMED"]').waitFor();
        await expectText(page, "synthetic source");
        await suite.pass(page, "mobile.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "mobile", "session-expired");
        expect(await page.locator("#mobile-confirm-ord-0001").getAttribute("aria-disabled")).toBe("true");
        await expectText(page, "expired");
        await suite.pass(page, "mobile.REJECT");
        await page.close();
    });
    it("UNKNOWN: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "mobile", "confirm-lost");
        await page.locator("#mobile-confirm-ord-0001").click();
        await page.locator('[data-outcome="UNKNOWN"]').waitFor();
        await expectText(page, "RESPONSE_LOST");
        await suite.pass(page, "mobile.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await holdNotice(page);
        await suite.pass(page, "mobile.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "mobile", "confirm-lost");
        await oneAttempt(page, suite, page.locator("#mobile-confirm-ord-0001"), async () => {
            await poll(() => page.locator("#mobile-record [data-counters]").innerText(), value => /Sent 1\./.test(value), "exactly one send");
        }, async () => {
            await page.locator("#mobile-scenario").waitFor();
            await poll(() => page.locator("#mobile-record [data-counters]").innerText(), value => /Sent 0\./.test(value), "no replay after reload");
        });
        await suite.pass(page, "mobile.one-attempt");
        await page.close();
    });
});
