import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App";
import { conflictControlId, heldAfterError } from "../src/a11y/focus";
import { AmountNotice, DeadlineLine, StatusMark, transportStatusWord } from "../src/a11y/marks";
import {
  AMOUNT_NOTICE,
  bookingQuantity,
  bookingQuantityNumber,
  capacityLine,
  copiedIntegerDigits,
  presentDeadline,
  presentIntegerUnits,
  presentQuantityLine,
  syntheticCountLine,
  syntheticTierLine,
} from "../src/a11y/present";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PAST = "2000-01-01T00:00:00.000Z";
const FUTURE = "2099-01-01T00:00:00.000Z";

describe("accessibility baseline", () => {
  it("copies whole units and refuses a float amount", () => {
    expect(presentIntegerUnits(20_000, "mock units")).toBe("20000 mock units");
    expect(presentIntegerUnits("20000", "mock units")).toBe("20000 mock units");
    expect(presentIntegerUnits(0, "mock units")).toBe("0 mock units");
    expect(copiedIntegerDigits(0.1)).toBeNull();
    expect(copiedIntegerDigits(0.1 + 0.2)).toBeNull();
    expect(presentIntegerUnits(0.1 + 0.2, "mock units")).toBe(
      "Amount refused. The figure was not a whole unit string, so it is not calculated here.",
    );
    expect(presentIntegerUnits("10.50", "mock units")).toBe(
      "Amount refused. The figure was not a whole unit string, so it is not calculated here.",
    );
    expect(presentIntegerUnits("10.50", "mock units")).not.toContain("10.5");
    expect(presentQuantityLine(2)).toBe("2. Count copied. Not an amount.");
    expect(capacityLine(40)).toBe("40 still open. Count copied. Not an amount.");
    expect(syntheticCountLine(4)).toBe("synthetic count 4");
    expect(syntheticTierLine("T3")).toBe("synthetic tier T3");
    expect(syntheticTierLine(null)).toBeNull();
    expect(AMOUNT_NOTICE).toContain("UNDETERMINED");
    expect(AMOUNT_NOTICE).not.toMatch(/[$₩]|KRW|USD/);

    const source = readFileSync(path.join(webRoot, "src/a11y/present.ts"), "utf8");
    expect(source).not.toMatch(/parseFloat|toFixed|toPrecision/);
    expect(source).not.toContain("0.1");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("settle_capture");
  });

  it("keeps expiry authority when the display locale changes", () => {
    const english = presentDeadline({ expiresAt: FUTURE, expired: true, locale: "en-GB" });
    const korean = presentDeadline({ expiresAt: FUTURE, expired: true, locale: "ko-KR" });
    expect(english.authority).toEqual(korean.authority);
    expect(english.authority).toEqual({ expiresAt: FUTURE, expired: true });
    expect(english.clock.endsWith("UTC")).toBe(true);
    expect(korean.clock.endsWith("UTC")).toBe(true);
    expect(english.clock).not.toBe(korean.clock);
    expect(english.authorityLine).toContain("Display locale does not decide expiry.");
    expect(korean.authorityLine).toContain(`Authority expiresAt ${FUTURE}.`);

    const past = presentDeadline({ expiresAt: PAST, expired: false, locale: "ko-KR" });
    expect(past.authority.expired).toBe(false);
    expect(past.authority.expiresAt).toBe(PAST);
    expect(past.clock).not.toBe(past.authority.expiresAt);

    const unspecified = presentDeadline({ expiresAt: FUTURE, expired: null, locale: "en-GB" });
    expect(unspecified.authority.expired).toBeNull();
    expect(unspecified.authorityLine).toContain("not decided on this page");
  });

  it("returns the typed value and the selection after an error", () => {
    const held = heldAfterError(
      { controlId: "booking-quantity", value: "1.5", selection: "evt_lanterns" },
      true,
    );
    expect(held).toEqual({ controlId: "booking-quantity", value: "1.5", selection: "evt_lanterns" });
    expect(heldAfterError({ controlId: "booking-quantity", value: "2", selection: "evt_lanterns" }, false)).toBeNull();
    expect(bookingQuantity("1.5")).toBeNull();
    expect(bookingQuantity("2")).toBe("2");
    expect(bookingQuantityNumber("2")).toBe(2);
    expect(bookingQuantityNumber("10")).toBeNull();
    expect(conflictControlId("ga-section")).toBe("discovery-section");
    expect(conflictControlId("cancelled-purchasable")).toBe("discovery-purchasable");
    expect(conflictControlId("from-after-to")).toBe("discovery-from");
    expect(conflictControlId("other")).toBeNull();
  });

  it("prints status words and the deadline authority in markup", () => {
    const marks = renderToStaticMarkup(
      <>
        <StatusMark kind="loading" />
        <StatusMark kind="blocked" />
        <StatusMark kind="selected" />
        <StatusMark kind="review" />
        <AmountNotice />
        <DeadlineLine expiresAt={PAST} expired={false} />
      </>,
    );
    expect(marks).toContain('data-status-mark="loading"');
    expect(marks).toContain("Loading");
    expect(marks).toContain('data-status-mark="blocked"');
    expect(marks).toContain("Blocked");
    expect(marks).toContain('data-status-mark="selected"');
    expect(marks).toContain("Selected");
    expect(marks).toContain("Selection is not a reservation");
    expect(marks).toContain('data-status-mark="review"');
    expect(marks).toContain("In review");
    expect(marks).toContain("Nothing has been sent.");
    expect(marks).toContain('data-amount="undetermined"');
    expect(marks).toContain(`dateTime="${PAST}"`);
    expect(marks).toContain('data-expired="false"');
    expect(marks).toContain(`data-expires-at="${PAST}"`);
    expect(marks).toContain("expired false");
    expect(transportStatusWord("unavailable")).toBe("Blocked.");
    expect(transportStatusWord("degraded")).toBe("Blocked.");
    expect(transportStatusWord("checking")).toBe("Loading.");
    expect(transportStatusWord("local")).toBe("Local.");
  });

  it("exposes the skip link and the booking loading sentence", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/booking/evt_lanterns"]}>
        <App />
      </MemoryRouter>,
    );
    expect(html).toContain('href="#desk-main"');
    expect(html).toContain("Skip to content");
    expect(html).toContain('id="desk-main"');
    expect(html).toContain("Loading the performance.");
    expect(html).toContain('data-status-mark="loading"');
    expect(html).toContain("Local.");
    expect(html).toContain("aria-label=\"Surfaces\"");
  });
});
