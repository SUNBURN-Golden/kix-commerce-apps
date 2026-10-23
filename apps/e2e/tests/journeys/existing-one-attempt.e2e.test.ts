import { describe, expect, it } from "vitest";
import { alertTexts, bookAndIssue, commitSettlement, expectFact, expectStepStatus, expectText, fact, newDeskPage, nav, panel, poll, press, stepRow } from "../../src/desk";
import { oneAttempt, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("one attempt on the original desks (stub)", () => {
    const suite = useBrowser();
    it("box-office: double click, two Enters and reload do not initiate a second mock case", async () => {
        const page = await newDeskPage(suite.newPage, suite.origin);
        await page.getByRole("button", { name: "Mock settlement" }).first().click();
        const scope = page.locator("aside", { hasText: "Mock settlement case" });
        await oneAttempt(page, suite, scope.getByRole("button", { name: "Initiate mock case", exact: true }), async () => {
            await expectFact(scope, "Mock phase", "INITIATED");
            expect(await alertTexts(page)).toEqual([]);
        }, async () => {
            await page.getByRole("heading", { name: "Tonight’s window" }).waitFor();
            await page.getByRole("button", { name: "Mock settlement" }).first().click();
            await expectFact(scope, "Mock phase", "Not opened");
        });
        await suite.pass(page, "box-office.one-attempt");
        await page.close();
    });
    it("credit: double click, two Enters and reload leave only the offered mock case", async () => {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Credit");
        await page.getByLabel("Mock case event").selectOption("evt_paper_orchestra");
        const scope = panel(page, "Mock credit case");
        await oneAttempt(page, suite, scope.getByRole("button", { name: "Offer mock phase", exact: true }), async () => {
            await expectFact(scope, "Mock phase", "OFFERED");
            expect(await alertTexts(page)).toEqual([]);
        }, async () => {
            await page.getByLabel("Mock case event").selectOption("evt_paper_orchestra");
            await expectFact(scope, "Mock phase", "Not opened");
        });
        await suite.pass(page, "credit.one-attempt");
        await page.close();
    });
    it("resale: double click, two Enters and reload leave one adopted mock right", async () => {
        const page = await newDeskPage(suite.newPage, suite.origin);
        await commitSettlement(page, "orchestra");
        await bookAndIssue(page, "orchestra");
        await nav(page, "Resale");
        await page.getByLabel("Mock case event").selectOption("evt_paper_orchestra");
        const scope = panel(page, "Mock resale case");
        await oneAttempt(page, suite, scope.getByRole("button", { name: "Adopt mock right", exact: true }), async () => {
            await expectFact(scope, "Mock phase", "ELIGIBLE");
            expect(await alertTexts(page)).toEqual([]);
        }, async () => {
            await page.getByLabel("Mock case event").selectOption("evt_paper_orchestra");
            await expectFact(scope, "Mock phase", "Not opened");
        });
        await suite.pass(page, "resale.one-attempt");
        await page.close();
    });
    it("admission: repeated consume input keeps the same consumed credential; reload sends no consume", async () => {
        const page = await newDeskPage(suite.newPage, suite.origin);
        await commitSettlement(page, "lanterns");
        await bookAndIssue(page, "lanterns");
        await nav(page, "Admission");
        await page.getByLabel("Performance id").fill("evt_lanterns");
        await press(page, "Load mock case");
        const scope = panel(page, "Admission credential");
        await press(scope, "Adopt issued mock credential");
        await press(scope, "Authorize mock credential");
        const consume = scope.getByRole("button", { name: "Consume mock credential once", exact: true });
        await consume.dblclick();
        await expectFact(scope, "Phase", "CONSUMED");
        const facts = await scope.locator("dl").innerText();
        await consume.focus();
        await page.keyboard.press("Enter");
        await page.keyboard.press("Enter");
        await expectFact(scope, "Credential state", "already-consumed");
        expect(await scope.locator("dl").innerText()).toBe(facts);
        expect(await alertTexts(page)).toEqual([]);
        await suite.quiet(page, "admission before reload");
        await page.reload();
        await page.getByLabel("Performance id").waitFor();
        expect(await page.getByLabel("Performance id").inputValue()).toBe("");
        expect(await fact(scope, "Phase")).not.toBe("CONSUMED");
        await suite.pass(page, "admission.one-attempt");
        await page.close();
    });
    for (const id of ["gift", "organizer"] as const)
        it(id + ": one published operation survives double click and keyboard, with no replay after reload", async () => {
            const page = await newDeskPage(suite.newPage, suite.origin);
            await nav(page, id === "gift" ? "Gift" : "Organizer");
            if (id === "gift") {
                for (const [field, value] of [["gift-id", "gift_once"], ["gift-ticket-id", "tkt_once"], ["gift-expected-version", "1"], ["gift-expires-at", "4102444800"]]) {
                    await page.locator("#" + field).fill(value);
                }
            }
            else {
                await page.getByLabel("Event id", { exact: true }).fill("evt_once");
                await page.getByLabel("Seats").fill("A1,A2");
            }
            const scope = page.locator(id === "gift" ? "aside.gift-panel" : "aside.organizer-panel");
            const step = id === "gift" ? "offer_gift" : "create_event";
            const row = stepRow(scope, step);
            await oneAttempt(page, suite, row.getByRole("button", { name: "Send " + step, exact: true }), async () => {
                await expectStepStatus(row, "confirmed");
                expect(await scope.locator('li[data-status="confirmed"]').count()).toBe(1);
            }, async () => {
                await scope.waitFor();
                expect(await scope.locator('li[data-status="confirmed"]').count()).toBe(0);
            });
            await suite.pass(page, id + ".one-attempt");
            await page.close();
        });
    it("marketplace-performance: an in-flight queue call blocks double click and keyboard; reload joins nothing", async () => {
        const page = await newDeskPage(suite.newPage, suite.origin);
        await nav(page, "Marketplace bench");
        await page.locator("#mperf-scenario").waitFor();
        await selectScenario(page, "mperf", "held");
        const join = page.locator("#mperf-join");
        await join.dblclick();
        const counter = page.locator("#mperf-session");
        await poll(() => counter.innerText(), t => /queue calls 1/.test(t), "one held queue call");
        await join.focus();
        await page.keyboard.press("Enter");
        await page.keyboard.press("Enter");
        expect(await counter.innerText()).toMatch(/queue calls 1/);
        await suite.quiet(page, "marketplace queue before reload");
        await page.reload();
        await page.locator("#mperf-scenario").waitFor();
        await expectText(page, "queue calls 0");
        await suite.pass(page, "marketplace-performance.one-attempt");
        await page.close();
    });
});
