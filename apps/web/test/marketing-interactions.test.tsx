// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MarketingStubDesk } from "../src/marketing/desk";
import { MARKETING_FIXTURES } from "../src/marketing/fixtures";
import { LocaleContext, stateFor } from "../src/i18n/locale-context";
import { messages } from "../src/i18n/messages/marketing--desk";
import { messages as deskCopy } from "../src/i18n/desk-catalogue";
import { M01Page } from "../src/pages/marketing/M01Membership";
import { M02Page } from "../src/pages/marketing/M02Presale";
import { M03Page } from "../src/pages/marketing/M03Coupons";
import { M04Page } from "../src/pages/marketing/M04Rewards";
import { MarketingHubPage } from "../src/pages/marketing/Hub";
import { protocol } from "../src/connectivity/desk-protocol";
import { connectivity } from "../src/connectivity/store";
import { button, change, click, element, renderDom } from "./support/render-dom";
const session = vi.hoisted(() => { vi.resetModules(); return { current: null as unknown as MarketingStubDesk }; });
vi.mock("../src/marketing/session", () => ({ get marketingSession() { return session.current; } }));
const at = "2026-10-30T00:00:00.000Z";
const view = (Screen: typeof M01Page, locale: "en" | "ko" = "en") => <LocaleContext.Provider value={stateFor(locale, () => {})}><MemoryRouter><Screen /></MemoryRouter></LocaleContext.Provider>;
beforeEach(() => { connectivity.setBrowserOnline(true); session.current = new MarketingStubDesk(() => at); });

describe.each(["en", "ko"] as const)("mounted marketing %s", (locale) => {
  const copy = messages[locale];
  it("M01 validates, joins, changes tier, clears and catches a handler refusal", async () => {
    const { container } = await renderDom(view(M01Page, locale));
    await click(element(container, '#membership-form button[type="submit"]'));
    expect(element(container, ".error-summary").contains(document.activeElement)).toBe(true);
    await change(element(container, "#membership-name"), "Browser fan");
    await click(element(container, '#membership-form button[type="submit"]'));
    expect(session.current.snapshot().membership?.tier).toBe("fan");
    await change(element(container, "#membership-form select"), "member");
    await click(element(container, '#membership-form button[type="submit"]'));
    expect(session.current.snapshot().membership?.tier).toBe("member");
    const leave = element(container, "#membership-form button.ghost");
    const refusal = vi.spyOn(session.current, "leave").mockImplementationOnce(() => { throw new Error("local refusal"); });
    await click(leave);
    expect(element(container, '[role="alert"]').textContent).toContain("local refusal");
    expect(session.current.snapshot().membership).not.toBeNull();
    refusal.mockRestore();
    await click(leave);
    expect(session.current.snapshot().membership).toBeNull();
    expect(element(container, "#m01-card-empty")).toBeDefined();
  });

  it("M02 records, withdraws, re-enters and the hub counts only active interests", async () => {
    session.current.join({ displayName: "Fan", tier: "fan" });
    const { container, rerender } = await renderDom(view(M02Page, locale));
    const first = () => element(container, ".program li");
    await click(element(first(), "button"));
    expect(document.activeElement?.id).toBe("m02-interest-evt_lanterns");
    expect((element<HTMLButtonElement>(first(), "button")).disabled).toBe(true);
    await click(button(first(), copy["marketing.withdraw"]));
    expect(first().textContent).toContain(copy["marketing.withdrawn"]);
    expect(element<HTMLButtonElement>(first(), "button").disabled).toBe(false);
    await rerender(view(MarketingHubPage, locale));
    expect(session.current.snapshot().interests.filter((row) => row.state === "recorded")).toHaveLength(0);
    await rerender(view(M02Page, locale));
    await click(element(first(), "button"));
    expect(session.current.snapshot().interests[0]?.state).toBe("recorded");
  });

  it("M03 keeps markers unchanged for expiry, future, unknown, duplicate and conflict refusals", async () => {
    const { container } = await renderDom(view(M03Page, locale));
    expect(container.textContent).toContain(copy["marketing.noCoupons"]);
    const submit = async (code: string) => {
      await change(element(container, "#coupon-code"), code);
      await click(element(container, '#coupon-form button[type="submit"]'));
    };
    for (const code of ["DEMO-EXPIRED", "DEMO-FUTURE", "DEMO-UNKNOWN", "ABSENT"]) {
      await submit(code);
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(session.current.snapshot().coupons).toEqual([]);
    }
    await submit("demo-group-a");
    expect(session.current.snapshot().coupons).toHaveLength(1);
    for (const code of ["DEMO-GROUP-A", "DEMO-GROUP-B"]) {
      await submit(code);
      expect(session.current.snapshot().coupons).toHaveLength(1);
    }
    expect(container.textContent).toContain(copy["marketing.couponConflict"]);
    expect(element(container, '[data-async-state="unknown"]').textContent).toContain(copy["marketing.coupon.unknown"]);
  });

  it("M04 records distinct normalized sources once and refuses blank, self and unknown attribution", async () => {
    const { container } = await renderDom(view(M04Page, locale));
    const submit = async (code: string) => {
      await change(element(container, "#referral-code"), code);
      await click(element(container, '#referral-form button[type="submit"]'));
    };
    await submit(" ");
    expect(container.querySelector(".error-summary")).not.toBeNull();
    for (const code of ["REF-STUB-SELF", "ABSENT", "REF-STUB-UNATTRIBUTED"]) await submit(code);
    expect(session.current.snapshot().rewardMarkers).toBe(0);
    await submit(" ref-stub-hall ");
    await submit("REF-STUB-HALL");
    expect(session.current.snapshot().rewardMarkers).toBe(1);
    await submit("REF-STUB-PAPER");
    expect(session.current.snapshot().rewardMarkers).toBe(2);
    expect(container.textContent).toContain("synthetic:REF-STUB-HALL");
    expect(container.textContent).toContain(copy["marketing.attribution"]);
  });

  it("unknown membership is explicit on M01, M02 and hub; refresh preserves knowledge and markers", async () => {
    session.current = new MarketingStubDesk(() => at, { ...MARKETING_FIXTURES, membershipKnowledge: "unknown" });
    session.current.applyCoupon("LANTERN-NOTE");
    session.current.acceptReferral("REF-STUB-HALL");
    const before = session.current.snapshot();
    const { container, rerender } = await renderDom(view(M01Page, locale));
    expect(element(container, '[data-async-state="unknown"]').textContent).toContain(copy["marketing.membershipUnknown"]);
    await click(element(container, "section > button"));
    expect(session.current.snapshot()).toEqual(before);
    await rerender(view(MarketingHubPage, locale));
    expect(element(container, "#marketing-session-facts").textContent).toContain("UNKNOWN");
    await rerender(view(M02Page, locale));
    expect(container.querySelector('[data-async-state="unknown"]')).not.toBeNull();
    expect(element<HTMLButtonElement>(container, ".program li button").disabled).toBe(true);
    await rerender(view(M01Page, locale));
    await click(element(container, "#membership-form button.ghost"));
    expect(session.current.snapshot().membershipKnowledge).toBe("known");
    expect(container.querySelector('[data-async-state="unknown"]')).toBeNull();
  });

  it("M02 read loading, empty and failed/unsupported reads stay distinct", async () => {
    let done!: (rows: []) => void;
    vi.spyOn(protocol, "listPerformances").mockReturnValueOnce(new Promise((resolve) => { done = resolve; }));
    const { container, unmount } = await renderDom(view(M02Page, locale));
    expect(container.textContent).toContain(deskCopy[locale]["desk.performance.loading"]);
    expect(container.querySelector("p.empty")).toBeNull();
    await import("react").then(({ act }) => act(async () => { done([]); }));
    expect(container.querySelector("p.empty")).not.toBeNull();
    await unmount();
    for (const message of ["read failed", "unsupported HTTP display read"]) {
      vi.spyOn(protocol, "listPerformances").mockRejectedValueOnce(new Error(message));
      const mounted = await renderDom(view(M02Page, locale));
      expect(element(mounted.container, '[data-async-state="error"]').textContent).toContain(message);
      expect(mounted.container.querySelector("p.empty")).toBeNull();
      await mounted.unmount();
    }
  });
});

it("locale switches preserve facts and expired history, empty fixture sets remain explicit", async () => {
  let clock = at;
  session.current = new MarketingStubDesk(() => clock, { ...MARKETING_FIXTURES, coupons: [{ ...MARKETING_FIXTURES.coupons[0]!, expiresAt: "2026-10-30T00:01:00.000Z" }] });
  session.current.applyCoupon("LANTERN-NOTE");
  clock = "2026-10-30T00:01:00.000Z";
  const { container, rerender } = await renderDom(view(M03Page));
  expect(element(container, '[data-coupon-state="expired"]').textContent).toContain(messages.en["marketing.coupon.expired"]);
  const before = session.current.snapshot();
  await rerender(view(M03Page, "ko"));
  expect(session.current.snapshot()).toEqual(before);
  expect(container.textContent).toContain(messages.ko["marketing.coupon.expired"]);
  session.current = new MarketingStubDesk(() => at, { ...MARKETING_FIXTURES, coupons: [] });
  await rerender(view(M01Page));
  await rerender(view(M03Page));
  expect(container.textContent).toContain(messages.en["marketing.noFixtures"]);
});
