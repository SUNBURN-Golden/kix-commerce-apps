// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CreditOriginationPage } from "../src/pages/CreditOrigination";
import { CreditServicingPage } from "../src/pages/CreditServicing";
import { change, click, element, renderDom } from "./support/render-dom";

describe("mounted synthetic credit desks", () => {
  it("records origination requests separately from review, commitment and drawdown", async () => {
    const { container } = await renderDom(<MemoryRouter><CreditOriginationPage /></MemoryRouter>);
    expect(element(container, "#origination-status").getAttribute("data-origination-state")).toBe("ready");
    await change(element(container, "#origination-amount"), "invalid");
    await click(element(container, "#origination-submit"));
    expect(element(container, "[data-last-action]").textContent).toContain("not sent");
    expect(document.activeElement?.id).toBe("origination-status");
    await change(element(container, "#origination-amount"), "1000");
    await click(element(container, "#origination-submit"));
    expect(element(container, "[data-last-request]").getAttribute("data-phase")).toBe("applied");
    await click(element(container, "#origination-refresh"));
    await click(element(container, "#origination-advance-review"));
    await click(element(container, "#origination-refresh"));
    await click(element(container, "#origination-advance-review"));
    await click(element(container, "#origination-refresh"));
    expect(element(container, "#origination-accept").hasAttribute("aria-disabled")).toBe(false);
    await click(element(container, "#origination-accept"));
    await click(element(container, "#origination-refresh"));
    await click(element(container, "#origination-drawdown"));
    expect(element(container, "[data-last-request]").getAttribute("data-phase")).toBe("applied");
    expect(container.textContent).toContain("not a disbursement");
  });

  it("preserves consent/document/policy fences and offers only synthetic correction paths", async () => {
    const { container } = await renderDom(<MemoryRouter><CreditOriginationPage /></MemoryRouter>);
    await change(element(container, "#origination-scenario"), "more-information");
    await click(element(container, "#origination-withdraw-consent"));
    await click(element(container, "#origination-refresh"));
    expect(element(container, "#origination-submit").getAttribute("aria-disabled")).toBe("true");
    await click(element(container, 'button[id^="origination-renew-"]:not([aria-disabled])'));
    await click(element(container, "#origination-refresh"));
    await click(element(container, "#origination-expire-document"));
    await click(element(container, "#origination-refresh"));
    await click(element(container, 'button[id^="origination-provide-"]:not([aria-disabled])'));
    await click(element(container, "#origination-refresh"));
    await click(element(container, "#origination-advance-policy"));
    await click(element(container, "#origination-refresh"));
    expect(container.textContent).toContain("revision");
    await click(element(container, "#origination-rival-request"));
    expect(element(container, "[data-last-action]").textContent).toContain("rival request");
    await click(element(container, "#origination-new-session"));
    expect(container.querySelector("[data-last-request]")).toBeNull();
    await change(element(container, "#origination-scenario"), "conditional");
    await click(element(container, "#origination-amend"));
    await click(element(container, "#origination-refresh"));
    await click(element(container, "#origination-rereview"));
    expect(element(container, "[data-last-request]").getAttribute("data-phase")).toBe("applied");
    await click(element(container, "#origination-revoke"));
    await click(element(container, "#origination-refresh"));
    expect(element(container, "#origination-status").getAttribute("data-origination-state")).toBe("denied");
    await click(element(container, "#origination-switch"));
    await click(element(container, "#origination-refresh"));
    expect(element(container, "#origination-status").getAttribute("data-origination-state")).toBe("denied");
    await change(element(container, "#origination-scenario"), "empty");
    await click(element(container, "#origination-switch"));
    await click(element(container, "#origination-refresh"));
    expect(element(container, "#origination-status").getAttribute("data-origination-state")).toBe("empty");
  });

  it("keeps servicing proposals distinct from approvals and source economic observations", async () => {
    const { container } = await renderDom(<MemoryRouter><CreditServicingPage /></MemoryRouter>);
    await change(element(container, "#servicing-scenario"), "unallocated");
    expect(element(container, "#servicing-status").getAttribute("data-servicing-state")).toBe("ready");
    await click(element(container, 'button[id^="servicing-propose-pmt"]:not([aria-disabled])'));
    expect(element(container, "[data-last-request]").getAttribute("data-phase")).toBe("applied");
    await click(element(container, "#servicing-refresh"));
    await click(element(container, "#servicing-propose-adjustment"));
    await click(element(container, "#servicing-refresh"));
    await click(element(container, 'button[id^="servicing-transition-"]:not([aria-disabled])'));
    await click(element(container, "#servicing-refresh"));
    await change(element(container, "#servicing-actor"), "credit-servicing-approver");
    await click(element(container, "#servicing-refresh"));
    await click(element(container, 'button[id^="servicing-approve-"]:not([aria-disabled])'));
    expect(element(container, "[data-last-action]").textContent).toContain("approv");
    await click(element(container, "#servicing-switch-actor"));
    await click(element(container, "#servicing-refresh"));
    for (const [id, message] of [
      ["observe-draw", "There is nothing at the synthetic source to move."], ["receive-payment", "observed a new payment"], ["reverse-allocation", "reversed an applied allocation"],
      ["mark-overdue", "marked a schedule row overdue"], ["advance-schedule", "moved the schedule to a newer revision"],
    ]) {
      await click(element(container, `#servicing-${id}`));
      expect(element(container, "[data-last-action]").textContent).toContain(message);
      await click(element(container, "#servicing-refresh"));
    }
    await click(element(container, "#servicing-new-session"));
    expect(container.querySelector("[data-last-request]")).toBeNull();
    await click(element(container, "#servicing-revoke"));
    await click(element(container, "#servicing-refresh"));
    expect(element(container, "#servicing-status").getAttribute("data-servicing-state")).toBe("denied");
    await click(element(container, "#servicing-switch"));
    await click(element(container, "#servicing-refresh"));
    expect(element(container, "#servicing-status").getAttribute("data-servicing-state")).toBe("denied");
  });
});
