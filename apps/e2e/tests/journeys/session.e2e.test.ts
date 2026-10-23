import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav, press } from "../../src/desk";
import { oneAttempt } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("session journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Session recovery");
        await page.locator("#session-status").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#session-attach-obs-0001").click();
        await page.locator('li[data-kind="this-load"][data-outcome="CONFIRMED"]').waitFor();
        await expectText(page, "Sent 1 in this load.");
        await suite.pass(page, "session.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("attach-lost");
        await press(page, "Start new source with this scenario");
        await page.locator("#session-attach-obs-0001").click();
        await page.locator('li[data-kind="unknown"]').waitFor();
        const held = page.locator("#session-attach-obs-0001");
        expect(await held.getAttribute("aria-disabled")).toBe("true");
        await held.focus();
        await page.keyboard.press("Enter");
        await expectText(page, "Sent 1 in this load.");
        await expectText(page, "unknown");
        await suite.pass(page, "session.REJECT");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await expectText(page, "not a protocol receipt");
        await expectText(page, "never composed and never sent");
        await expectNoButton(page, BANNED_SEND);
        await expectText(page, "Retention is UNDETERMINED.");
        await suite.pass(page, "session.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("attach-lost");
        await press(page, "Start new source with this scenario");
        await oneAttempt(page, suite, page.locator("#session-attach-obs-0001"), async () => {
            await expectText(page, "Sent 1 in this load.");
            expect(await page.locator('li[data-kind="unknown"]').count()).toBe(1);
        }, async () => {
            await page.locator("#session-status").waitFor();
            await expectText(page, "Sent 0 in this load.");
            await expectText(page, "came back as UNKNOWN");
            await expectText(page, "Nothing was sent again");
        });
        await suite.pass(page, "session.one-attempt");
        await page.close();
    });
});
