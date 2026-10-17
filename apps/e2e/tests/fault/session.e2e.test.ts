import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { newDeskPage, nav, poll, press } from "../../src/desk";
import { useBrowser } from "../../src/suite";

const JOURNAL_KEY = "kix-session-journal";

describe("fault injection on /session (stub, headless Chrome)", () => {
  const suite = useBrowser();

  async function openSession(page: Page): Promise<void> {
    await nav(page, "Session recovery");
    await page.getByRole("heading", { name: "Session recovery (synthetic)" }).waitFor();
  }

  async function status(page: Page): Promise<string> {
    return (await page.getByTestId("session-status").textContent()) ?? "";
  }

  async function attachLost(page: Page): Promise<void> {
    await page.getByLabel("Scenario").selectOption("attach-lost");
    await press(page, "Start new source with this scenario");
    const attach = page.locator("#session-attach-obs-0001");
    await poll(() => attach.isEnabled(), (enabled) => enabled, "attach enabled");
    await attach.click();
    await poll(() => status(page), (text) => /unknown|unconfirmed|lost/i.test(text), "an unknown status");
  }

  /** The attach control stays focusable, is off, and says why. Nothing was sent. */
  async function expectHeld(page: Page): Promise<void> {
    const attach = page.locator("#session-attach-obs-0001");
    await poll(() => attach.getAttribute("aria-disabled"), (value) => value === "true", "attach held (aria-disabled)");
    const reason = (await page.locator("#session-attach-obs-0001-reason").textContent()) ?? "";
    expect(reason).toMatch(/held|WRITE_REFUSED|NO_STORE|LOST_DURING_SESSION|SESSION_EVIDENCE_LOST/);
    const text = await status(page);
    expect(text).toMatch(/Sent 0 in this load/);
    expect(text).not.toMatch(/confirmed/i);
  }

  async function reload(page: Page): Promise<void> {
    await press(page, "Reload this page");
    await page.getByRole("heading", { name: "Session recovery (synthetic)" }).waitFor();
  }

  it("FI-B01: a storage quota error on the write-ahead record refuses the attach and sends nothing", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await page.addInitScript((key) => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name: string, value: string) {
        if (name === key) {
          throw new DOMException("quota", "QuotaExceededError");
        }
        return set.call(this, name, value);
      };
    }, JOURNAL_KEY);
    await page.reload();
    await openSession(page);
    await page.getByLabel("Scenario").selectOption("attach-lost");
    await press(page, "Start new source with this scenario");
    await expectHeld(page);
    await suite.pass(page, "fault.FI-B01.storage-quota-on-attach");
    await page.close();
  });

  it("FI-B02: a corrupt journal blob injected before a reload holds the session as evidence lost", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await openSession(page);
    await attachLost(page);
    await page.evaluate((key) => sessionStorage.setItem(key, "{not json"), JOURNAL_KEY);
    await reload(page);
    const text = await poll(() => status(page), (current) => /SESSION_EVIDENCE_LOST/.test(current), "SESSION_EVIDENCE_LOST");
    expect(text).toMatch(/Sent 0 in this load/);
    await suite.pass(page, "fault.FI-B02.corrupt-blob-before-reload");
    await page.close();
  });

  it("FI-B03: clearing storage in the middle of a session leaves the in-memory fence and sends nothing more", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await openSession(page);
    await attachLost(page);
    await page.evaluate(() => sessionStorage.clear());
    await press(page, "Read again");
    const text = await poll(() => status(page), (current) => /RESPONSE_LOST/.test(current), "the unknown still shown");
    // The in-memory fence outlives the cleared store: one send, no second one, no confirmed text.
    expect(text).toMatch(/Sent 1 in this load/);
    expect(text).not.toMatch(/confirmed/i);
    const attach = page.locator("#session-attach-obs-0001");
    await poll(() => attach.getAttribute("aria-disabled"), (value) => value === "true", "attach still held");
    expect((await page.locator("#session-attach-obs-0001-reason").textContent()) ?? "").toMatch(/earlier write on this subject/);
    await suite.pass(page, "fault.FI-B03.storage-cleared-mid-session");
    await page.close();
  });

  it("FI-B04: a blocked sessionStorage still loads the page and holds writes", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await page.addInitScript(() => {
      Object.defineProperty(window, "sessionStorage", {
        configurable: true,
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    await page.reload();
    await openSession(page);
    await page.getByLabel("Scenario").selectOption("attach-lost");
    await press(page, "Start new source with this scenario");
    await expectHeld(page);
    await suite.pass(page, "fault.FI-B04.blocked-session-storage");
    await page.close();
  });

  it("FI-B05: three reloads of a held answer keep UNKNOWN and Sent 0 each time", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await openSession(page);
    await attachLost(page);
    for (let i = 0; i < 3; i += 1) {
      await reload(page);
      const text = await poll(() => status(page), (current) => /came back as UNKNOWN/.test(current), `UNKNOWN after reload ${i + 1}`);
      expect(text).toMatch(/Sent 0 in this load/);
      expect(text).toMatch(/Nothing was sent again/);
    }
    await suite.pass(page, "fault.FI-B05.repeated-reload-held-answer");
    await page.close();
  });
});
