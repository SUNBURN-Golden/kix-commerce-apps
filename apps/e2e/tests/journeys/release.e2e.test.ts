import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav, poll } from "../../src/desk";
import { attribute, oneAttempt, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("release journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Release");
        await page.locator("#rel-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#rel-run").click();
        await attribute(page, "#rel-status [data-run-state]", "data-run-state", "ready");
        expect(await page.locator("[data-packet]").count()).toBe(1);
        await suite.pass(page, "release.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "rel", "claims-pass");
        await page.locator("#rel-run").click();
        await attribute(page, "#rel-status [data-run-state]", "data-run-state", "unknown");
        await expectText(page, "UNTRUSTED_PACKET");
        expect(await page.locator("[data-packet]").count()).toBe(0);
        await suite.pass(page, "release.REJECT");
        await page.close();
    });
    it("UNKNOWN: changing actor while the lost run is pending keeps the journal unknown", async () => {
        const page = await open();
        await selectScenario(page, "rel", "read-lost");
        await page.locator("#rel-run").click();
        await attribute(page, "#rel-status [data-run-state]", "data-run-state", "in-flight");
        await page.locator("#rel-switch-actor").click();
        await poll(() => page.locator("#rel-session").innerText(), text => /UNKNOWN/.test(text) && /CONTEXT_SWITCHED/.test(text), "unknown context-switched intent");
        expect(await page.locator("#rel-run").getAttribute("aria-disabled")).toBe("true");
        expect(await page.locator("[data-packet]").count()).toBe(0);
        await suite.pass(page, "release.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#rel-run").click();
        await attribute(page, "#rel-status [data-run-state]", "data-run-state", "ready");
        await expectText(page, "reserve_listing");
        await expectText(page, "not-bound");
        await expectText(page, "false");
        await expectNoButton(page, BANNED_SEND);
        await suite.pass(page, "release.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "rel", "read-lost");
        await oneAttempt(page, suite, page.locator("#rel-run"), async () => {
            await attribute(page, "#rel-status [data-run-state]", "data-run-state", "in-flight");
            await poll(() => page.locator("#rel-session").innerText(), t => /Sent 1\./.test(t), "one run");
        }, async () => {
            await page.locator("#rel-run").waitFor();
            await poll(() => page.locator("#rel-session").innerText(), t => /Sent 0\./.test(t), "zero replay");
            expect(await page.locator("#rel-packet").count()).toBe(0);
        });
        await suite.pass(page, "release.one-attempt");
        await page.close();
    });
});
