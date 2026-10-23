// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProviderJourneyPage } from "../src/pages/ProviderJourney";
import { MarketingJourneyPage } from "../src/pages/MarketingJourney";
import { change, click, element, renderDom } from "./support/render-dom";

describe("mounted synthetic journeys", () => {
  it("keeps checkout return, report, payment observation, issuance and refund separate", async () => {
    const { container } = await renderDom(<MemoryRouter><ProviderJourneyPage /></MemoryRouter>);
    await click(element(container, 'button[id^="provider-begin-"]:not([aria-disabled])'));
    await click(element(container, '[data-source-event="return"]'));
    expect(element(container, "[data-last-action]").textContent).toContain("not a payment observation");
    expect(element(container, 'button[id^="provider-issue-"]').getAttribute("aria-disabled")).toBe("true");
    await click(element(container, '[data-source-event="callback"]'));
    await click(element(container, 'button[id^="provider-observe-"]:not([aria-disabled])'));
    expect(element(container, '[data-facet="payment"]').getAttribute("data-write")).toBe("confirmed");
    await click(element(container, 'button[id^="provider-issue-"]:not([aria-disabled])'));
    await click(element(container, 'button[id^="provider-refund-"]:not([aria-disabled])'));
    expect(element(container, "[data-last-action]").textContent).toContain("confirmed by the synthetic source");
    await click(element(container, "#provider-new-session"));
    await click(element(container, 'button[id^="provider-begin-"]:not([aria-disabled])'));
    await click(element(container, '[data-source-event="abandon"]'));
    expect(element(container, "[data-last-action]").textContent).toContain("abandoned");
    await click(element(container, "#provider-switch"));
    await click(element(container, "#provider-refresh"));
    expect(container.textContent).toContain("unqualified");
    await change(element(container, "#provider-scenario"), "empty");
    expect(element(container, "#provider-status").getAttribute("data-provider-state")).toBe("empty");
  });

  it("keeps a lost provider observation unknown after its late result", async () => {
    const { container } = await renderDom(<MemoryRouter><ProviderJourneyPage /></MemoryRouter>);
    await change(element(container, "#provider-scenario"), "observe-late");
    await click(element(container, 'button[id^="provider-begin-"]:not([aria-disabled])'));
    await click(element(container, '[data-source-event="return"]'));
    await click(element(container, '[data-source-event="callback"]'));
    await click(element(container, 'button[id^="provider-observe-"]:not([aria-disabled])'));
    expect(container.textContent).toContain("unknown");
    await click(element(container, "#provider-deliver-late"));
    expect(element(container, "[data-last-action]").textContent).toContain("write stays unknown");
    await click(element(container, "#provider-deliver-late"));
    expect(element(container, "[data-last-action]").textContent).toContain("No late result");
    await change(element(container, "#provider-scenario"), "held-response");
    await click(element(container, 'button[id^="provider-begin-"]:not([aria-disabled])'));
    expect(container.textContent).toContain("in flight");
    await click(element(container, "#provider-deliver-held"));
    expect(container.textContent).toContain("confirmed");
  });

  it("applies and reclaims a benefit only in the synthetic journey, preserving consent boundaries", async () => {
    const { container } = await renderDom(<MemoryRouter><MarketingJourneyPage /></MemoryRouter>);
    await click(element(container, 'button[id^="mkj-apply-ben"]:not([aria-disabled])'));
    expect(container.querySelector("[data-application]")).not.toBeNull();
    await click(element(container, 'button[id^="mkj-cancel-"]:not([aria-disabled])'));
    await click(element(container, "#mkj-refresh"));
    await click(element(container, 'button[id^="mkj-reclaim-"]:not([aria-disabled])'));
    expect(element(container, "[data-last-action]").textContent).toContain("Reclaim");
    await click(element(container, "#mkj-new-session"));
    await click(element(container, 'button[id^="mkj-refund-"]:not([aria-disabled])'));
    await click(element(container, "#mkj-refresh"));
    expect(container.textContent).toContain("refund");
    await click(element(container, "#mkj-simulate-withdraw-consent"));
    await click(element(container, "#mkj-refresh"));
    expect(container.textContent).toContain("withdrawn");
    await click(element(container, "#mkj-simulate-grant-consent"));
    await click(element(container, "#mkj-simulate-authorize-marketing"));
    await click(element(container, "#mkj-simulate-lapse-eligibility"));
    expect(element(container, "[data-last-action]").textContent).toContain("membership basis changed");
    await click(element(container, "#mkj-switch"));
    await click(element(container, "#mkj-refresh"));
    expect(element(container, "#mkj-status").getAttribute("data-marketing-state")).toBe("denied");
    await click(element(container, "#mkj-switch"));
    await change(element(container, "#mkj-scenario"), "held-response");
    await click(element(container, "#mkj-apply-scenario"));
    await click(element(container, 'button[id^="mkj-apply-ben"]:not([aria-disabled])'));
    expect(container.textContent).toContain("in flight");
    await click(element(container, "#mkj-deliver-held"));
    expect(container.querySelector("[data-application]")).not.toBeNull();
    await click(element(container, "#mkj-deliver-held"));
    expect(element(container, "[data-last-action]").textContent).toContain("No held response");
    await change(element(container, "#mkj-scenario"), "empty");
    await click(element(container, "#mkj-apply-scenario"));
    expect(element(container, "#mkj-status").getAttribute("data-marketing-state")).toBe("empty");
  });
});
