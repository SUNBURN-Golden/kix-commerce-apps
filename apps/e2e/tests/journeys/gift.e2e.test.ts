import { describe, expect, it } from "vitest";
import { RULING, expectNoButton, expectStepStatus, expectText, fact, newDeskPage, nav, poll, press, stepRow } from "../../src/desk";
import { useBrowser } from "../../src/suite";

describe("gift journey (stub, headless Chrome)", () => {
  const suite = useBrowser();

  async function openGift() {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await nav(page, "Gift");
    await page.getByRole("heading", { name: "Gift transfer" }).first().waitFor();
    return page;
  }

  async function fillDraft(page: Awaited<ReturnType<typeof openGift>>, giftId: string) {
    await page.locator("#gift-id").fill(giftId);
    await page.locator("#gift-ticket-id").fill("tkt_1");
    await page.locator("#gift-expected-version").fill("1");
    await page.locator("#gift-expires-at").fill("4102444800");
  }

  it("SUCCESS: offer_gift, then accept_gift, with the caller's own fields and one operation each", async () => {
    const page = await openGift();
    await fillDraft(page, "gift_ok");
    const panel = page.locator("aside.gift-panel");
    await press(stepRow(panel, "offer_gift"), "Send offer_gift");
    await expectStepStatus(stepRow(panel, "offer_gift"), "confirmed");
    await press(stepRow(panel, "accept_gift"), "Send accept_gift");
    await expectStepStatus(stepRow(panel, "accept_gift"), "confirmed");
    await expectText(page, "gft:gift_ok:1:offer_gift");
    await expectText(page, "gft:gift_ok:1:accept_gift");
    await expectText(page, "Confirmed stub-shape receipt. Not from the gate.");
    expect(await panel.getAttribute("data-gift-path")).toBe("available-stub-shape");
    expect(await page.getByText("gft:gift_ok:1:offer_gift", { exact: true }).count()).toBe(1);
    // After accept the offer is settled: nothing may be sent a second time.
    expect(await panel.getByRole("button", { name: /^Send / }).evaluateAll((els) => els.every((el) => (el as HTMLButtonElement).disabled))).toBe(true);
    await suite.pass(page, "gift.SUCCESS");
    await page.close();
  });

  it("REJECT (not sent): an incomplete body is refused before sending, and focus returns to the ticket id", async () => {
    const page = await openGift();
    await page.locator("#gift-id").fill("gift_blank");
    const panel = page.locator("aside.gift-panel");
    await press(stepRow(panel, "offer_gift"), "Send offer_gift");
    await expectStepStatus(stepRow(panel, "offer_gift"), "not-sent");
    expect(await fact(stepRow(panel, "offer_gift"), "Status")).toBe("Not sent");
    await expectText(page, "Not sent. Field body.");
    await poll(() => page.evaluate(() => document.activeElement?.id ?? ""), (id) => id === "gift-ticket-id", "focus on gift-ticket-id");
    expect(await page.locator("#gift-ticket-id").getAttribute("aria-invalid")).toBe("true");
    expect(await stepRow(panel, "accept_gift").getAttribute("data-status")).not.toBe("confirmed");
    await suite.pass(page, "gift.REJECT");
    await page.close();
  });

  it("NOT_BOUND: a gift offer is not a credit draw, and capture, settle_capture and issue_invitation are not sent here", async () => {
    const page = await openGift();
    await expectText(page, "Gift offer is not a credit draw.");
    await expectText(page, RULING);
    await expectText(page, "offerCredit");
    await expectText(page, "acceptResale(listingId) does not match accept_trade");
    const sends = await page.locator("aside.gift-panel").getByRole("button", { name: /^Send / }).allInnerTexts();
    expect(sends).toEqual(["Send offer_gift", "Send accept_gift", "Send cancel_gift"]);
    await expectNoButton(page, /capture|settle_capture|issue_invitation|commit_trade/i);
    await suite.pass(page, "gift.NOT_BOUND");
    await page.close();
  });
});
