import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav, poll } from "../../src/desk";
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
    it("searches bilingual labels across reload, history, pagination, and locale changes", async () => {
        const page = await open();
        const input = page.locator("#discovery-q");
        const results = page.locator("#discovery-results");
        const ids = () => results.getByRole("option").evaluateAll(rows => rows.map(row => row.id));
        const search = async (text: string) => {
            await input.fill(text);
            await page.waitForURL(url => url.searchParams.get("q") === text);
        };
        await search("등불");
        const expected = ["syn-event-lanterns", "syn-event-cancelled", "syn-seat-sample", "syn-ga-sample", "syn-resale-sample"]
            .map(id => `discovery-result-${id}`);
        await poll(ids, current => JSON.stringify(current) === JSON.stringify(expected), "rendered bilingual search results");
        await search("Lanterns");
        expect(await ids()).toEqual(expected);
        await search("등불".normalize("NFD"));
        expect(await ids()).toEqual(expected);
        await page.locator('[data-locale="ko"]').click();
        await expectText(page, "등불 합성 공연");
        expect(await ids()).toEqual(expected);
        await suite.quiet(page, "localized search before reload");
        await page.reload();
        await input.waitFor();
        expect(await input.inputValue()).toBe("등불".normalize("NFD"));
        expect(await ids()).toEqual(expected);
        await search("북쪽 별관");
        await page.locator("#discovery-page-size").selectOption("10");
        await page.waitForURL(url => url.searchParams.get("pageSize") === "10");
        await page.locator('[data-locale="en"]').click();
        const pageOne = await ids();
        await results.getByRole("button", { name: "Next page", exact: true }).click();
        await page.waitForURL(url => url.searchParams.get("page") === "2");
        const pageTwo = await poll(ids, current => current.length === 10 && current[0] !== pageOne[0], "rendered second search page");
        expect(pageTwo).toHaveLength(10);
        const pageTwoUrl = page.url();
        await page.locator('[data-locale="ko"]').click();
        await expectText(page, "북쪽 별관");
        expect(await ids()).toEqual(pageTwo);
        expect(page.url()).toBe(pageTwoUrl);
        await page.locator('[data-locale="en"]').click();
        expect(await ids()).toEqual(pageTwo);
        await suite.quiet(page, "venue pagination before reload");
        await page.reload();
        await input.waitFor();
        expect(page.url()).toBe(pageTwoUrl);
        expect(await ids()).toEqual(pageTwo);
        await results.getByRole("option").first().getByRole("button").click();
        await page.locator("#discovery-detail").waitFor();
        await page.goBack();
        await input.waitFor();
        expect(page.url()).toBe(pageTwoUrl);
        expect(await ids()).toEqual(pageTwo);
        await page.goForward();
        await page.locator("#discovery-detail").waitFor();
        await page.getByRole("link", { name: "Back to results", exact: true }).click();
        await input.waitFor();
        expect(page.url()).toBe(pageTwoUrl);
        expect(await ids()).toEqual(pageTwo);
        await page.locator('input[name="statuses"][value="on-sale"]').check();
        await page.waitForURL(url => url.searchParams.get("statuses") === "on-sale" && !url.searchParams.has("page"));
        await poll(ids, current => current[0] === "discovery-result-syn-event-paper", "rendered first filtered search page");
        expect(await results.locator('[role=option]:not([data-status="on-sale"])').count()).toBe(0);
        const filteredUrl = page.url();
        const filteredIds = await ids();
        await suite.quiet(page, "combined filter before reload");
        await page.reload();
        await input.waitFor();
        expect(page.url()).toBe(filteredUrl);
        expect(await ids()).toEqual(filteredIds);
        await search("no-such-venue");
        await poll(() => results.getAttribute("data-state"), state => state === "empty", "empty search");
        expect(await ids()).toEqual([]);
        await input.fill("");
        await page.waitForURL(url => !url.searchParams.has("q"));
        await poll(() => results.getByRole("option").count(), count => count > 0, "rendered blank search results");
        await suite.quiet(page, "localized search completion");
        await page.close();
    });
    it("retains searched cancelled, resale, inventory, sold-out, unlinked, and stale restrictions", async () => {
        const page = await open();
        for (const [id, purchase] of [
            ["syn-event-cancelled", "unsupported"], ["syn-resale-sample", "not-bound"],
            ["syn-seat-sample", "unsupported"], ["syn-ga-sample", "unsupported"],
            ["syn-event-sold-out", "unsupported"], ["syn-event-unlinked", "unsupported"],
            ["syn-event-stale", "booking"],
        ] as const) {
            await page.locator("#discovery-q").fill(id);
            await page.waitForURL(url => url.searchParams.get("q") === id);
            await page.locator(`#discovery-result-${id}`).getByRole("button").click();
            await page.locator(`#discovery-detail [data-purchase="${purchase}"]`).waitFor();
            if (purchase === "booking") {
                await expectText(page, "STALE");
                expect(await page.locator('#discovery-detail a[href="/booking/evt_paper_orchestra"]').count()).toBe(1);
            } else {
                expect(await page.locator('#discovery-detail a[href^="/booking/"]').count()).toBe(0);
            }
            await expectNoButton(page, BANNED_SEND);
            await page.goBack();
            await page.locator("#discovery-q").waitFor();
        }
        await suite.quiet(page, "searched purchase restrictions");
        await page.close();
    });
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
