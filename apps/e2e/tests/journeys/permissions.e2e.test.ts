import { describe, expect, it } from "vitest";
import { expectText, newDeskPage, nav, poll } from "../../src/desk";
import { attribute, holdNotice, oneAttempt, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("permissions journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Permissions");
        await page.locator("#tenant-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#tenant-actor").selectOption("person-settler");
        await page.locator("#tenant-apply-actor").click();
        await page.locator("#tenant-role").selectOption("settler");
        await page.locator("#tenant-apply-role").click();
        await page.locator("#tenant-account-acc-0001").waitFor();
        await page.locator("#tenant-account-acc-0001").click();
        await attribute(page, "[data-request-seq]", "data-request-phase", "applied");
        await page.locator("#tenant-refresh").click();
        expect(await page.locator("[data-proposal]").count()).toBe(1);
        await suite.pass(page, "permissions.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "tenant", "denied");
        await attribute(page, "#tenant-status", "data-tenant-state", "denied");
        await expectText(page, "denied");
        await suite.pass(page, "permissions.REJECT");
        await page.close();
    });
    it("UNKNOWN: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "tenant", "act-lost");
        await page.locator("#tenant-actor").selectOption("person-settler");
        await page.locator("#tenant-apply-actor").click();
        await page.locator("#tenant-role").selectOption("settler");
        await page.locator("#tenant-apply-role").click();
        await page.locator("#tenant-account-acc-0001").waitFor();
        await page.locator("#tenant-account-acc-0001").click();
        await attribute(page, "[data-request-seq]", "data-request-phase", "unknown");
        await expectText(page, "unknown");
        await suite.pass(page, "permissions.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await holdNotice(page);
        await suite.pass(page, "permissions.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "tenant", "act-lost");
        await page.locator("#tenant-actor").selectOption("person-settler");
        await page.locator("#tenant-apply-actor").click();
        await page.locator("#tenant-role").selectOption("settler");
        await page.locator("#tenant-apply-role").click();
        await page.locator("#tenant-account-acc-0001").waitFor();
        await oneAttempt(page, suite, page.locator("#tenant-account-acc-0001"), async () => {
            await poll(() => page.locator("#tenant-session").innerText(), value => /Requests 1\./.test(value), "exactly one send");
        }, async () => {
            await page.locator("#tenant-scenario").waitFor();
            await poll(() => page.locator("#tenant-session").innerText(), value => /Requests 0\./.test(value), "no replay after reload");
        });
        await suite.pass(page, "permissions.one-attempt");
        await page.close();
    });
});
