import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav } from "../../src/desk";
import { useBrowser } from "../../src/suite";
describe("discovery journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Discover");
        await page.locator("#discovery-q").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#discovery-q").fill("Lanterns");
        await page.waitForURL(url => url.searchParams.get("q") === "Lanterns");
        const list = page.locator("#discovery-results [role=listbox]");
        expect(await list.getByRole("option").count()).toBeGreaterThan(0);
        await list.focus();
        await page.keyboard.press("Enter");
        await page.waitForURL(url => url.pathname.startsWith("/discovery/"));
        await expectText(page, "SYNTHETIC");
        await suite.pass(page, "discovery.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#discovery-from").fill("2030-01-01");
        await page.waitForURL(url => url.searchParams.get("from") === "2030-01-01");
        await page.locator("#discovery-to").fill("2020-01-01");
        await page.locator("#discovery-conflict").waitFor();
        await expectText(page, "conflict");
        await suite.pass(page, "discovery.REJECT");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#discovery-q").fill("resale");
        await page.waitForURL(url => url.searchParams.get("q") === "resale");
        await page.locator("#discovery-results [role=option]").first().getByRole("button").click();
        await page.locator('[data-purchase="not-bound"]').waitFor();
        expect(await page.locator('[data-purchase="not-bound"]').innerText()).toMatch(/no |not /i);
        await expectNoButton(page, BANNED_SEND);
        await suite.pass(page, "discovery.NOT_BOUND");
        await page.close();
    });
});
