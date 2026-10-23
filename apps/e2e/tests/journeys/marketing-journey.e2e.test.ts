import { describe, expect, it } from "vitest";
import { expectText, newDeskPage, nav, poll } from "../../src/desk";
import { holdNotice, oneAttempt, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("marketing-journey journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Benefit journey");
        await page.locator("#mkj-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#mkj-apply-ben-0002-ord-0001").click();
        await page.locator('[data-outcome="CONFIRMED"]').waitFor();
        expect(await page.locator("[data-application]").count()).toBe(1);
        await suite.pass(page, "marketing-journey.SUCCESS");
        await page.close();
    });
    it("REJECT: usage limit blocks the apply control before sending", async () => {
        const page = await open();
        await selectScenario(page, "mkj", "usage-limit");
        const apply = page.locator("#mkj-apply-ben-0002-ord-0001");
        await poll(() => apply.getAttribute("aria-disabled"), value => value === "true", "usage limit guard");
        await apply.focus();
        await page.keyboard.press("Enter");
        await expectText(page, "The source says this benefit reached the usage it allows.");
        expect(await page.locator("#mkj-session [data-intent]").count()).toBe(0);
        await suite.pass(page, "marketing-journey.REJECT");
        await page.close();
    });
    it("UNKNOWN: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "mkj", "apply-lost");
        await page.locator("#mkj-apply-ben-0002-ord-0001").click();
        await page.locator('[data-outcome="UNKNOWN"]').waitFor();
        await expectText(page, "RESPONSE_LOST");
        await suite.pass(page, "marketing-journey.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await holdNotice(page);
        await suite.pass(page, "marketing-journey.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "mkj", "apply-lost");
        await oneAttempt(page, suite, page.locator("#mkj-apply-ben-0002-ord-0001"), async () => {
            await poll(() => page.locator("#mkj-session [data-counters]").innerText(), value => /Sent 1\./.test(value), "exactly one send");
        }, async () => {
            await page.locator("#mkj-scenario").waitFor();
            await poll(() => page.locator("#mkj-session [data-counters]").innerText(), value => /Sent 0\./.test(value), "no replay after reload");
        });
        await suite.pass(page, "marketing-journey.one-attempt");
        await page.close();
    });
});
