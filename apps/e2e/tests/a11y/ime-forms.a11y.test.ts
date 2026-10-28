import { describe, expect, it } from "vitest";
import { useBrowser } from "../../src/suite";
import { compositionEvents, confirmation, engineComposition, observeComposition } from "../../src/composition";
import { formProblems } from "../../src/a11y-keyboard";
import { recordFacet } from "../../src/a11y-record";
import { openScreen } from "./helpers";

const rows = [
  { name: "booking", path: "/booking/evt_lanterns", form: "booking-form", field: "booking-quantity", action: "Place hold" },
  { name: "gift", path: "/gift", form: "gift-form", field: "gift-ticket-id", action: "Send offer_gift" },
  { name: "organizer", path: "/organizer", form: "organizer-form", field: "organizer-event", action: "Send create_event" },
] as const;

describe("IME automated browser evidence; native user acceptance PENDING", () => {
  const suite = useBrowser({ context: { locale: "ko-KR" } });
  for (const row of rows) {
    it(`${row.name}: browser-engine composition, cancellation, injected confirmation, invalid summary and exactly one deliberate send`, async () => {
      const page = await suite.newPage();
      await page.addInitScript(() => {
        window.__kixIme = { attempts: 0, mode: "held" };
        window.__kixFormDeferred = { attempts: 0 };
      });
      await openScreen(page, suite.faultOrigin!, row.path);
      const input = page.locator(`#${row.field}`);
      await input.waitFor();
      const attempts = () => page.evaluate((name) => name === "booking" ? window.__kixFormDeferred!.attempts : window.__kixIme!.attempts, row.name);
      const action = page.getByRole("button", { name: new RegExp(`^${row.action}`) });
      if (row.name === "gift") {
        await page.locator("#gift-id").fill("ime-gift");
        await page.locator("#gift-expected-version").fill("1");
        await page.locator("#gift-expires-at").fill("4102444800");
      }
      if (row.name === "organizer") await page.locator("#organizer-seats").fill("A1");
      await input.fill("");
      await observeComposition(page, `#${row.field}`);
      await engineComposition(page, `#${row.field}`, false, async () => {
        await page.locator(`#${row.form}`).evaluate((el) => (el as HTMLFormElement).requestSubmit());
        await action.dispatchEvent("click");
        expect(await attempts()).toBe(0);
        expect(await input.evaluate((el) => document.activeElement === el)).toBe(true);
        expect(await page.locator(".error-summary").count()).toBe(0);
      });
      expect(await input.inputValue()).toBe("한글");
      const trace = await compositionEvents(page);
      expect(trace.map((e) => e.type)).toContain("compositionstart");
      expect(trace.map((e) => e.type)).toContain("compositionend");
      expect(trace.some((e) => e.type === "input" && e.composing)).toBe(true);
      expect(await input.evaluate((el) => document.activeElement === el)).toBe(true);
      expect(await attempts()).toBe(0);
      expect(await page.locator('[data-validation-refused="true"]').count()).toBe(0);
      recordFacet({ kind: "observation", id: `a11y.forms.ime.${row.name}.engine`, note: `Chrome ${suite.session().version}; ko-KR; CDP preedit; events=${JSON.stringify(trace)}; sends=0; native OS IME acceptance PENDING` });
      for (const order of ["end-first", "key-first", "229"] as const) {
        await confirmation(page, `#${row.field}`, order);
        expect(await attempts()).toBe(0);
        expect(await input.evaluate((el) => document.activeElement === el)).toBe(true);
      }
      const beforeCancel = await input.inputValue();
      await engineComposition(page, `#${row.field}`, true);
      expect(await input.inputValue()).toBe(beforeCancel);
      await confirmation(page, `#${row.field}`, "key-first", true);
      expect(await page.locator(".error-summary:focus").count()).toBe(0);
      expect(await attempts()).toBe(0);
      // Organizer's empty-event row is domain-disabled; exercise its editable seats error instead.
      const invalidId = row.name === "organizer" ? "organizer-seats" : row.field;
      const invalidInput = page.locator(`#${invalidId}`);
      // Blur validates without requesting summary focus.
      await invalidInput.fill("");
      await invalidInput.blur();
      expect(await invalidInput.getAttribute("aria-invalid")).toBe("true");
      expect(await page.locator(".error-summary").evaluate((el) => el === document.activeElement)).toBe(false);
      if (row.name === "booking") await input.press("Enter");
      else await action.click();
      expect(await page.locator(".error-summary").evaluate((el) => el === document.activeElement)).toBe(true);
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("href"))).toBe(`#${invalidId}`);
      await page.keyboard.press("Enter");
      expect(await formProblems(page, invalidId)).toEqual([]);
      await invalidInput.fill(row.name === "organizer" ? "A1" : row.name === "booking" ? "1" : "한글");
      if (row.name === "booking") await input.press("Enter");
      else {
        await input.press("Enter"); // these forms intentionally have no send-on-submit
        expect(await attempts()).toBe(0);
        await action.click();
      }
      await page.waitForFunction((name) => (name === "booking" ? window.__kixFormDeferred!.attempts : window.__kixIme!.attempts) === 1, row.name);
      await page.locator(`#${row.form}`).evaluate((el) => (el as HTMLFormElement).requestSubmit());
      expect(await attempts()).toBe(1);
      await page.evaluate((name) => name === "booking" ? window.__kixFormDeferred?.release?.() : window.__kixIme?.release?.(), row.name);
      if (row.name === "booking") await page.locator("#booking-confirm").waitFor();
      else await page.locator(`aside.${row.name}-panel li[data-status='confirmed']`).first().waitFor();
      expect(await attempts()).toBe(1);
      await suite.pass(page, `a11y.forms.ime.${row.name}`);
      await page.close();
    });

    it(`${row.name}: offline and reconnect do not replay composition; UNKNOWN keeps external writes fenced`, async () => {
      const page = await suite.newPage();
      await page.addInitScript(() => { window.__kixIme = { attempts: 0, mode: "unknown" }; window.__kixFormDeferred = { attempts: 0 }; });
      await openScreen(page, suite.faultOrigin!, row.path);
      const input = page.locator(`#${row.field}`);
      await input.waitFor();
      if (row.name === "gift") {
        for (const [id, value] of [["gift-id", "ime-offline"], ["gift-expected-version", "1"], ["gift-expires-at", "4102444800"]]) await page.locator(`#${id}`).fill(value);
      }
      if (row.name === "organizer") await page.locator("#organizer-seats").fill("A1");
      await input.fill(row.name === "booking" ? "1" : "한글");
      await suite.session().context.setOffline(true);
      await page.locator('[data-connectivity-state="offline"]').waitFor();
      await confirmation(page, `#${row.field}`, "end-first");
      const action = page.getByRole("button", { name: new RegExp(`^${row.action}`) });
      await action.focus();
      await page.keyboard.press("Enter");
      expect(await page.evaluate(() => window.__kixIme!.attempts + window.__kixFormDeferred!.attempts)).toBe(0);
      await suite.session().context.setOffline(false);
      await page.locator('[data-connectivity-state="local"]').waitFor();
      expect(await page.evaluate(() => window.__kixIme!.attempts + window.__kixFormDeferred!.attempts)).toBe(0);
      if (row.name !== "booking") {
        await action.click();
        await page.locator(`aside.${row.name}-panel li[data-status='unconfirmed']`).first().waitFor();
        expect(await page.evaluate(() => window.__kixIme!.attempts)).toBe(1);
        await page.locator(`#${row.form}`).evaluate((el) => (el as HTMLFormElement).requestSubmit());
        await action.dispatchEvent("click");
        expect(await page.evaluate(() => window.__kixIme!.attempts)).toBe(1);
      }
      await suite.pass(page, `a11y.forms.ime.${row.name}.guards`);
      await page.close();
    });
  }
});
