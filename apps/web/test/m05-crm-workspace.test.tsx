// @vitest-environment jsdom
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { consentDesk } from "../src/consent-desk";
import { LocaleContext, stateFor } from "../src/i18n/locale-context";
import { marketingSession } from "../src/marketing/session";
import { M05Page } from "../src/pages/marketing/M05Consent";
import { M05CrmWorkspace } from "../src/pages/marketing/M05CrmWorkspace";
import { button, change, click, element, renderDom } from "./support/render-dom";

const values = { event: "crm-component", subject: "subject-fixture", business: "business-fixture", channel: "fixture-channel", purpose: "fixture-purpose", version: "1" };
function page(locale: "en" | "ko") {
  return <MemoryRouter><LocaleContext.Provider value={stateFor(locale, () => {})}><M05Page /></LocaleContext.Provider></MemoryRouter>;
}
async function fill(container: HTMLElement) {
  for (const [key, value] of Object.entries(values)) await change(element(container, `#consent-${key}`), value);
  await change(element(container, "#consent-allowed"), "true");
}
async function filters(container: HTMLElement) {
  for (const [key, value] of Object.entries({ eventId: values.event, business: values.business, channel: values.channel, purpose: values.purpose })) {
    await change(element(container, `#crm-${key}`), value);
  }
}
beforeEach(() => { consentDesk.reset(); marketingSession.reset(); });
describe("mounted M05 CRM workspace", () => {
  it("reads shared confirmed evidence; filters and locale changes send nothing; flags stay separate from withdrawal", async () => {
    const spy = vi.spyOn(consentDesk, "send");
    const { container, rerender } = await renderDom(page("en"));
    expect(container.textContent).toContain("M05 · CRM / 데이터 활용 · 미착수");
    expect(element(container, "[data-crm-count]").textContent).toBe("Included: 0");
    expect(container.querySelectorAll('[data-crm-fan]')).toHaveLength(3);
    await fill(container);
    expect(element(container, "[data-crm-count]").textContent).toBe("Included: 0");
    await click(button(container, "Send set_consent"));
    await filters(container);
    expect(element(container, '[data-crm-fan="fixture-01"]').textContent).toContain("Fresh authorization required");
    await click(button(container, "Send authorize_marketing"));
    expect(element(container, "[data-crm-count]").textContent).toBe("Included: 1");
    await click(button(container, "Withdraw flags"));
    expect(element(container, "[data-crm-count]").textContent).toBe("Included: 1");
    await change(element(container, "#crm-tier"), "member");
    expect(element(container, "[data-crm-count]").textContent).toBe("Included: 0");
    await change(element(container, "#crm-tier"), "all");
    await rerender(page("ko"));
    expect(element(container, "[data-crm-count]").textContent).toBe("포함: 1");
    expect(container.textContent).toContain("합성 CRM 작업 공간");
    expect(container.textContent).toContain("채널별 선호");
    expect(container.textContent).toContain("데이터 활용 목적 원장");
    expect(element<HTMLSelectElement>(container, "#crm-channel").value).toBe(values.channel);
    expect(spy).toHaveBeenCalledTimes(2);
    await change(element(container, "#consent-allowed"), "false");
    await click(button(container, "전송 set_consent"));
    expect(element(container, "[data-crm-count]").textContent).toBe("포함: 0");
    expect(element(container, '[data-crm-fan="fixture-01"]').textContent).toContain("확인된 동의 철회");
    expect(container.textContent).toContain("STALE");
    const stored = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.getItem(sessionStorage.key(index)!) ?? "").join(" ");
    for (const value of [values.subject, values.business, values.channel, values.purpose, "consentOperationId"]) expect(stored).not.toContain(value);
    await act(async () => consentDesk.reset());
    expect(container.textContent).toContain("기록된 합성 대상 범위 없음.");
  });

  it.each(["en", "ko"] as const)("labels controls, tables, status and keyboard scroll regions in %s", async (locale) => {
    const { container } = await renderDom(page(locale));
    const workspace = element(container, "[data-crm-mode]");
    for (const select of Array.from(workspace.querySelectorAll("select"))) {
      expect(workspace.querySelector(`label[for="${select.id}"]`)?.textContent?.length).toBeGreaterThan(0);
      expect(select.tabIndex).toBe(0);
    }
    expect(workspace.querySelectorAll("table caption")).toHaveLength(3);
    expect(workspace.querySelectorAll('th[scope="col"]').length).toBeGreaterThan(10);
    expect(workspace.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
    const regions = workspace.querySelectorAll<HTMLElement>('[role="region"]');
    expect(regions).toHaveLength(3);
    for (const region of Array.from(regions)) { region.focus(); expect(document.activeElement).toBe(region); expect(region.getAttribute("aria-label")).toBeTruthy(); }
  });

  it("shows NOT_BOUND in HTTP mode without fixture controls or rows", async () => {
    const snapshot = { ...consentDesk.getSnapshot(), environment: "integration-http" as const };
    const { container } = await renderDom(<M05CrmWorkspace snapshot={snapshot} flags={marketingSession.snapshot().consent} />);
    expect(container.textContent).toContain("NOT_BOUND");
    expect(container.querySelectorAll("select, table, [data-crm-fan]")).toHaveLength(0);
  });
});
