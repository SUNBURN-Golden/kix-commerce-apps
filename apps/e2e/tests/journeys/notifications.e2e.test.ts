import { describe, expect, it } from "vitest";
import { expectText, newDeskPage, nav, poll } from "../../src/desk";
import { attribute, holdNotice, oneAttempt, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("notifications journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Notifications");
        await page.locator("#notify-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#notify-mark-ntf-0001").click();
        await attribute(page, "[data-request-seq]", "data-request-phase", "applied");
        await page.locator("#notify-refresh").click();
        await expectText(page, "read");
        await suite.pass(page, "notifications.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "notify", "denied");
        await attribute(page, "#notify-status", "data-notify-state", "denied");
        await expectText(page, "denied");
        await suite.pass(page, "notifications.REJECT");
        await page.close();
    });
    it("UNKNOWN: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "notify", "act-lost");
        await page.locator("#notify-mark-ntf-0001").click();
        await attribute(page, "[data-request-seq]", "data-request-phase", "unknown");
        await expectText(page, "unknown");
        await suite.pass(page, "notifications.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await holdNotice(page);
        await suite.pass(page, "notifications.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "notify", "act-lost");
        await oneAttempt(page, suite, page.locator("#notify-mark-ntf-0001"), async () => {
            await poll(() => page.locator("#notify-session").innerText(), value => /Requests 1\./.test(value), "exactly one send");
        }, async () => {
            await page.locator("#notify-scenario").waitFor();
            await poll(() => page.locator("#notify-session").innerText(), value => /Requests 0\./.test(value), "no replay after reload");
        });
        await suite.pass(page, "notifications.one-attempt");
        await page.close();
    });
});

// These globals exist only in the separately built, explicitly gated fixture.
declare global {
    interface Window {
        __kixNotificationPagination?: boolean;
        __kixNotificationChange?: (count: number, allUnread?: boolean) => void;
    }
}

describe("notification pagination on the gated fault origin", () => {
    const suite = useBrowser();
    it("traverses the same ordered evidence, restores URL visits and preserves explicit action effects", async () => {
        const page = await suite.newPage();
        await page.addInitScript(() => { window.__kixNotificationPagination = true; });
        await page.goto(suite.faultOrigin! + "/notifications?lang=en");
        const items = page.locator("[data-notification]");
        const rows = page.locator("[data-notification-row]");
        const status = page.locator("#notify-page-status");
        await poll(() => items.count(), (n) => n === 20, "large inbox ready");
        const unread = await page.locator("[data-unread-line]").innerText();
        const seen: string[] = [];
        for (let n = 1; n <= 6; n++) {
            const ids = await items.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-notification")!));
            expect(ids.length).toBeLessThanOrEqual(20);
            expect(await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-notification-row")))).toEqual(ids);
            seen.push(...ids);
            expect(await page.locator("[data-unread-line]").innerText()).toBe(unread);
            if (n < 6) { await page.getByRole("button", { name: "Next", exact: true }).click(); await poll(() => status.innerText(), (s) => s.includes(`Page ${n + 1} of 6`), "next page"); }
        }
        expect(seen).toEqual([...Array.from({ length: 104 }, (_, i) => `ntf-${1001 + i}`), "ntf-0001"]);
        await items.last().locator('[data-read-choice="item"]').click();
        expect(new URL(page.url()).searchParams.get("item")).toBe("ntf-0001");
        await page.getByRole("button", { name: "First", exact: true }).click();
        await page.locator("#read-filter").selectOption("unread");
        await page.locator("#read-apply-filter").click();
        await poll(() => status.innerText(), (s) => s.includes("Page 1 of 4"), "unread filter");
        await page.goBack();
        await poll(() => status.innerText(), (s) => s.includes("Page 6 of 6"), "history selection page");
        await page.goForward();
        await poll(() => status.innerText(), (s) => s.includes("Page 1 of 4"), "history filter page");
        await page.goto(suite.faultOrigin! + "/notifications?lang=en&item=ntf-0001");
        await poll(() => status.innerText(), (s) => s.includes("Page 6 of 6"), "deep link");
        await page.reload();
        await poll(() => status.innerText(), (s) => s.includes("Page 6 of 6"), "reloaded deep link");
        expect(await page.locator("[data-request-seq]").count()).toBe(0);
        await page.locator("#read-filter").selectOption("all");
        await page.locator("#read-apply-filter").click();
        await page.getByRole("button", { name: "First", exact: true }).click();
        for (const size of [41, 20, 0, 21]) {
            await page.evaluate((count) => window.__kixNotificationChange?.(count), size);
            await poll(() => page.locator("#notify-inbox").getAttribute("data-total-count"), (v) => v === String(size), "resized snapshot");
            if (size === 41) await page.getByRole("button", { name: "Last", exact: true }).click();
            else expect(await status.innerText()).toContain(size ? `Page 1 of ${Math.ceil(size / 20)}` : "Page 0 of 0");
        }
        await page.evaluate(() => window.__kixNotificationChange?.(21, true));
        await page.locator("#read-filter").selectOption("unread");
        await page.locator("#read-apply-filter").click();
        await poll(() => status.innerText(), (s) => s.includes("21 matching"), "21 unread");
        await page.getByRole("button", { name: "Last", exact: true }).click();
        await page.locator("#notify-mark-ntf-0001").click();
        await attribute(page, "[data-request-seq]", "data-request-phase", "applied");
        expect(await items.count()).toBe(1);
        await page.locator("#notify-refresh").click();
        await poll(() => status.innerText(), (s) => s.includes("20 matching"), "explicit refresh removes read row");
        expect(await items.count()).toBe(20);
        expect(await page.locator("[data-request-seq]").count()).toBe(1);
        await suite.quiet(page, "notification paging is local and mark-read remains one explicit action");
        await page.close();
    });
});
