import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav, poll, press } from "../../src/desk";
import { oneAttempt } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("identity journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Journey context");
        await page.locator("#identity-status").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#attach-obs-0001").click();
        await page.locator('li[data-outcome="CONFIRMED"]').waitFor();
        await expectText(page, "Sent 1.");
        await suite.pass(page, "identity.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("foreign-mix");
        await press(page, "Apply this scenario");
        await page.locator('tr[data-verdict="foreign"]').first().waitFor();
        expect(await page.locator('tr[data-verdict="foreign"] button[aria-disabled="true"]').count()).toBeGreaterThan(0);
        await suite.pass(page, "identity.REJECT");
        await page.close();
    });
    it("UNKNOWN: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("attach-lost");
        await press(page, "Apply this scenario");
        await page.locator("#attach-obs-0001").click();
        await page.locator('li[data-outcome="UNKNOWN"]').waitFor();
        await expectText(page, "RESPONSE_LOST");
        await suite.pass(page, "identity.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await expectText(page, "not a protocol receipt");
        await expectText(page, "never composed and never sent");
        await expectNoButton(page, BANNED_SEND);
        await suite.pass(page, "identity.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("attach-lost");
        await press(page, "Apply this scenario");
        await oneAttempt(page, suite, page.locator("#attach-obs-0001"), async () => {
            await poll(() => page.locator("#identity-status").innerText(), t => /Sent 1\./.test(t), "one attach");
            expect(await page.locator('li[data-outcome="UNKNOWN"]').count()).toBe(1);
        }, async () => {
            await page.locator("#identity-status").waitFor();
            await expectText(page, "Sent 0.");
            expect(await page.locator('li[data-outcome="UNKNOWN"]').count()).toBe(0);
        });
        await suite.pass(page, "identity.one-attempt");
        await page.close();
    });
});
