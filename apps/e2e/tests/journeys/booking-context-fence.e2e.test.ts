import { describe, expect, it } from "vitest";
import { EVENTS, expectText, nav, poll } from "../../src/desk";
import { useBrowser } from "../../src/suite";

declare global {
  interface Window {
    __kixBookingFence?: { held: string[]; calls: Array<{ method: string; args: unknown[] }>; releases: Record<string, () => void> };
  }
}

describe("booking page-load event fence", () => {
  const suite = useBrowser();
  for (const kind of ["hold", "release", "confirm", "refresh"] as const) it(`retains ${kind} through in-app A-B-A navigation`, async () => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixBookingFence = { held: [], calls: [], releases: {} }; });
    await page.goto(suite.faultOrigin + "/?lang=en");
    async function open(event: "lanterns" | "orchestra") {
      await nav(page, "Box office");
      await page.getByRole("link", { name: "Book", exact: true }).nth(EVENTS[event].row).click();
      await page.getByRole("heading", { name: EVENTS[event].title, exact: true }).waitFor();
    }
    await open("lanterns");
    await page.locator("#booking-quantity").fill("2");
    let holdText: string | null = null;
    if (kind === "release" || kind === "confirm") {
      await page.locator("#booking-place").click();
      await page.locator("#booking-confirm").waitFor();
      holdText = await page.locator("#booking-form strong").innerText();
    }
    const method = kind === "hold" || kind === "refresh" ? "placeHold" : kind === "release" ? "releaseHold" : "confirmBooking";
    await page.evaluate((method) => { window.__kixBookingFence!.held = [method]; }, kind === "refresh" ? "listPerformances" : method);
    await page.locator(`#booking-${kind === "hold" || kind === "refresh" ? "place" : kind}`).click();
    await page.waitForFunction((method) => Boolean(window.__kixBookingFence!.releases[method]), kind === "refresh" ? "listPerformances" : method);
    // Other panels also read the catalogue; release all subsequent reads and hold only the captured promise.
    await page.evaluate(() => { window.__kixBookingFence!.held = []; });
    await open("orchestra");
    expect(await page.locator("#booking-place").isEnabled()).toBe(true);
    expect(await page.locator("#booking-quantity").inputValue()).toBe("1");
    expect(await page.locator("#booking-form").innerText()).not.toContain(holdText ?? "hold_");
    await open("lanterns");
    expect(await page.locator(`#booking-${kind === "hold" ? "place" : "confirm"}`).isDisabled()).toBe(true);
    expect(await page.locator("#booking-quantity").inputValue()).toBe("2");
    if (holdText) expect(await page.locator("#booking-form strong").innerText()).toBe(holdText);
    await expectText(page, "One attempt");
    await open("orchestra");
    await page.evaluate((method) => window.__kixBookingFence!.releases[method](), kind === "refresh" ? "listPerformances" : method);
    await suite.quiet(page, "inactive booking completion");
    expect(await page.locator('a[href*="rightsRef="]').count()).toBe(0);
    await open("lanterns");
    if (kind === "confirm") {
      const link = page.locator('a[href*="rightsRef="]'); await link.waitFor();
      const url = new URL((await link.getAttribute("href"))!, suite.faultOrigin);
      expect(url.searchParams.get("eventId")).toBe(EVENTS.lanterns.id);
      expect(url.searchParams.get("rightsRef")).toBeTruthy();
    } else {
      await poll(() => page.locator(kind === "release" ? "#booking-place" : "#booking-confirm").isEnabled(), Boolean, "original event unlocked only after its result");
    }
    const writes = await page.evaluate(() => window.__kixBookingFence!.calls.filter((call) => call.method !== "listPerformances"));
    expect(writes.map((call) => call.method)).toEqual(kind === "release" || kind === "confirm" ? ["placeHold", method] : ["placeHold"]);
    expect(writes[0].args).toEqual([{ eventId: EVENTS.lanterns.id, quantity: 2 }]);
    if (holdText) expect(writes[1].args).toEqual([holdText]);
    await suite.pass(page, `booking.context.${kind}`);
    await page.close();
  });
});
