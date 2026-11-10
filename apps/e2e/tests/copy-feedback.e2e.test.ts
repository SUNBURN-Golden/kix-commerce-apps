import { describe, expect, it } from "vitest";
import { tabTo } from "../src/a11y-keyboard";
import { keyboardOnly } from "../src/keyboard-guard";
import { useBrowser } from "../src/suite";
import { messages as receiptCopy } from "../../web/src/i18n/messages/pages--Receipts";
import { messages as diagnosticCopy } from "../../web/src/i18n/messages/pages--Diagnostics";

declare global {
  interface Window {
    __kixCopyTest: { writes: string[]; storageWrites: number; receiver: boolean };
  }
}
const screens = [
  { name: "receipts", area: "#receipt-diagnostic", button: "#receipt-export button", status: "#receipt-export [role=status]" },
  { name: "diagnostics", area: "#diagnostics-export", button: "#diagnostics-copy", status: '[data-page="diagnostics"] .receipt-export [role=status]' },
] as const;

describe("copy feedback keyboard controls (stub)", () => {
  const suite = useBrowser();
  for (const screen of screens) for (const locale of ["en", "ko"] as const) for (const mode of ["success", "absent", "throw", "reject"] as const) {
    it(`${screen.name} ${locale} ${mode}: selectable exact export and localized feedback`, async () => {
      const guard = await keyboardOnly(await suite.newPage());
      const page = guard.page;
      await page.addInitScript((mode) => {
        window.__kixCopyTest = { writes: [], storageWrites: 0, receiver: true };
        const clipboard = { writeText(this: unknown, text: string) {
          window.__kixCopyTest.receiver &&= this === clipboard;
          window.__kixCopyTest.writes.push(text);
          if (mode === "throw") throw Error("private clipboard exception");
          return mode === "reject" ? Promise.reject(Error("private clipboard exception")) : Promise.resolve();
        } };
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: mode === "absent" ? undefined : clipboard });
      }, mode);
      await page.goto(`${suite.origin}/${screen.name}?lang=${locale}`);
      await page.locator(screen.area).waitFor();
      const before = await page.locator(screen.area).inputValue();
      // Locale/onboarding setup is outside the copy-action storage window.
      const storageBefore = await page.evaluate(() => {
        for (const method of ["setItem", "removeItem", "clear"] as const) {
          const original = Storage.prototype[method];
          Object.defineProperty(Storage.prototype, method, { configurable: true, value: function (this: Storage, ...args: unknown[]) {
            window.__kixCopyTest.storageWrites += 1;
            return Reflect.apply(original, this, args);
          } });
        }
        return JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]);
      });
      expect(await tabTo(page, screen.button)).toBe(true);
      await page.keyboard.press("Shift+Tab");
      expect(await page.evaluate(() => document.activeElement?.id)).toBe(screen.area.slice(1));
      await page.keyboard.press("Tab");
      expect(await page.locator(screen.button).evaluate((node) => node === document.activeElement)).toBe(true);
      await page.keyboard.press(locale === "en" ? "Enter" : "Space");
      const expected = screen.name === "receipts" ? receiptCopy[locale][mode === "success" ? "e.36" : "e.35"] :
        diagnosticCopy[locale][mode === "success" ? "diag.copied" : "diag.selected"];
      await expect.poll(() => page.locator(screen.status).textContent()).toBe(expected);
      expect(await page.locator(screen.area).evaluate((node) => {
        const area = node as HTMLTextAreaElement;
        return { focused: document.activeElement === area, start: area.selectionStart, end: area.selectionEnd, length: area.value.length };
      })).toEqual({ focused: true, start: 0, end: before.length, length: before.length });
      expect(await page.locator(screen.area).inputValue()).toBe(before);
      expect(await page.evaluate(() => window.__kixCopyTest)).toEqual({ writes: mode === "absent" ? [] : [before], storageWrites: 0, receiver: true });
      expect(await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]))).toBe(storageBefore);
      await guard.assertNoPointer();
      await suite.pass(page, `copy-feedback.${screen.name}.${locale}.${mode}`);
      await page.close();
    });
  }
});
