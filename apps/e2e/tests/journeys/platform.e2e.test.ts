import { describe, expect, it } from "vitest";
import { expectText, newDeskPage, nav, poll } from "../../src/desk";
import { holdNotice, oneAttempt, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("platform journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Trading platform");
        await page.locator("#platform-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#platform-book-lst-0001").click();
        await page.locator('[id^="platform-transfer-trd-"]').first().click();
        await page.locator('[data-outcome="CONFIRMED"]').nth(1).waitFor();
        await expectText(page, "This is not a protocol receipt.");
        await suite.pass(page, "platform.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "platform", "rival-channel");
        await page.locator("#platform-book-lst-0001").click();
        await page.locator('[id^="platform-transfer-trd-"]').first().click();
        await page.locator('[data-outcome="REJECTED"]').waitFor();
        await expectText(page, "VERSION_STALE");
        await suite.pass(page, "platform.REJECT");
        await page.close();
    });
    it("UNKNOWN: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "platform", "payment-lost");
        await page.locator("#platform-book-lst-0001").click();
        await page.locator('[data-shape="payment-unknown"]').waitFor();
        expect(await page.locator('button[id^="platform-transfer-"]').first().getAttribute("aria-disabled")).toBe("true");
        await suite.pass(page, "platform.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await holdNotice(page);
        await suite.pass(page, "platform.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "platform", "book-lost");
        await oneAttempt(page, suite, page.locator("#platform-book-lst-0001"), async () => {
            await poll(() => page.locator("#platform-session [data-counters]").innerText(), value => /Sent 1\./.test(value), "exactly one send");
        }, async () => {
            await page.locator("#platform-scenario").waitFor();
            await poll(() => page.locator("#platform-session [data-counters]").innerText(), value => /Sent 0\./.test(value), "no replay after reload");
        });
        await suite.pass(page, "platform.one-attempt");
        await page.close();
    });
});
