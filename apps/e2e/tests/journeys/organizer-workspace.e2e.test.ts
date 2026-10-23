import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav, press } from "../../src/desk";
import { oneAttempt } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("organizer-workspace journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Organizer workspace");
        await page.locator(".organizer-ws").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#organizer-ws-event-id").fill("evt_browser_workspace");
        await page.locator("#organizer-ws-seats").fill("A1,A2");
        await press(page, "Add to change list");
        await press(page, "Prepare preview");
        await press(page, "Submit");
        await page.locator('[data-result="RECEIPT"]').waitFor();
        await suite.pass(page, "organizer-workspace.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await press(page, "Add to change list");
        await page.locator(".error-summary").waitFor();
        expect(await page.locator('[data-result="RECEIPT"]').count()).toBe(0);
        await suite.pass(page, "organizer-workspace.REJECT");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await expectText(page, "NOT_BOUND Organizer desk: No command is bound here.");
        await expectText(page, "Not composed.");
        await expectNoButton(page, BANNED_SEND);
        await expectNoButton(page, /capture|settle_capture|commit_trade|^Send admit$/i);
        await suite.pass(page, "organizer-workspace.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#organizer-ws-event-id").fill("evt_browser_workspace");
        await page.locator("#organizer-ws-seats").fill("A1,A2");
        await press(page, "Add to change list");
        await press(page, "Prepare preview");
        await oneAttempt(page, suite, page.getByRole("button", { name: "Submit", exact: true }), async () => {
            await page.locator('[data-result="RECEIPT"]').waitFor();
            expect(await page.locator('[data-result="RECEIPT"]').count()).toBe(1);
        }, async () => {
            await page.locator(".organizer-ws").waitFor();
            expect(await page.locator('[data-result="RECEIPT"]').count()).toBe(0);
        });
        await suite.pass(page, "organizer-workspace.one-attempt");
        await page.close();
    });
});
