import { describe, it } from "vitest";
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
