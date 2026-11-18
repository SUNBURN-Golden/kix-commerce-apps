// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { button, change, click, dispatch, element, renderDom } from "./support/render-dom";

import { journalBlob, journalRecord, MAX_COUNTER as M } from "../../../packages/protocol-adapter/test/support/session-journal-fixtures";
import { messages as counterCopy } from "../src/i18n/messages/session-recovery";

// The production controller intentionally lasts for one page load. Each case is a new load.
beforeEach(() => { vi.resetModules(); });

async function mountRecovery(locale: "en" | "ko" = "en") {
  const { SessionRecoveryPage } = await import("../src/pages/SessionRecovery");
  const { LocaleProvider } = await import("../src/i18n/LocaleProvider");
  return renderDom(<LocaleProvider initial={locale}><MemoryRouter><SessionRecoveryPage /></MemoryRouter></LocaleProvider>);
}

describe("mounted session recovery", () => {
  it("records a clean attach and removes page listeners on unmount", async () => {
    const addedWindow = vi.spyOn(window, "addEventListener");
    const removedWindow = vi.spyOn(window, "removeEventListener");
    const addedDocument = vi.spyOn(document, "addEventListener");
    const removedDocument = vi.spyOn(document, "removeEventListener");
    const view = await mountRecovery();
    expect(view.container.querySelector('[data-session-state="empty"]')).not.toBeNull();
    await click(button(view.container, "Attach"));
    expect(view.container.querySelector('[data-outcome="CONFIRMED"]')).not.toBeNull();
    expect(sessionStorage.getItem("kix-session-journal")).toContain("CONFIRMED");
    await click(button(view.container, "Read again"));
    expect(view.container.querySelectorAll('[data-outcome="CONFIRMED"]')).toHaveLength(1);
    await view.unmount();
    const show = addedWindow.mock.calls.find(([name]) => name === "pageshow")!;
    const visible = addedDocument.mock.calls.find(([name]) => name === "visibilitychange")!;
    expect(removedWindow).toHaveBeenCalledWith(...show);
    expect(removedDocument).toHaveBeenCalledWith(...visible);
  });

  it("resumes an in-flight intent as UNKNOWN and keeps late evidence fenced without resending", async () => {
    const { container } = await mountRecovery();
    await change(element(container, "select"), "held-response");
    await click(button(container, "Start new source with this scenario"));
    await click(button(container, "Attach"));
    expect(container.querySelector('[data-outcome="IN_FLIGHT"]')).not.toBeNull();
    expect(container.querySelector('[data-session-state="in-progress"]')).not.toBeNull();
    await dispatch(window, new PageTransitionEvent("pageshow", { persisted: true }));
    expect(container.querySelector('[data-outcome="UNKNOWN"]')).not.toBeNull();
    expect(container.querySelector('[data-session-state="recovered"]')).not.toBeNull();
    await click(button(container, "Deliver held response"));
    expect(container.querySelector('[data-outcome="UNKNOWN"]')).not.toBeNull();
    expect(container.querySelector('[data-outcome="OBSERVED"]')).not.toBeNull();
    await click(button(container, "Read again"));
    const attach = button(container, "Attach");
    expect(attach.getAttribute("aria-disabled")).toBe("true");
    await click(attach);
    expect(container.querySelectorAll('[data-outcome="UNKNOWN"]')).toHaveLength(1);
    expect(container.textContent).toContain("Sent 1 in this load");
    await click(button(container, "Deliver held response"));
    expect(container.textContent).toContain("No held response to deliver");
    await dispatch(document, new Event("visibilitychange"));
    expect(container.querySelector('[data-outcome="UNKNOWN"]')).not.toBeNull();
  });

  it("blocks every write when the tab store is unavailable", async () => {
    vi.stubGlobal("sessionStorage", undefined);
    const { container } = await mountRecovery();
    expect(container.querySelector('[data-session-state="unavailable"]')).not.toBeNull();
    expect(button(container, "Attach").getAttribute("aria-disabled")).toBe("true");
    await click(button(container, "Attach"));
    expect(container.textContent).toContain("Sent 0 in this load");
    expect(container.querySelector("[data-outcome]")).toBeNull();
  });
});

describe("mounted counter integrity refusals", () => {
  it.each(["en", "ko"] as const)("keeps load exhaustion fenced across activation, resume and reload in %s", async (locale) => {
    const raw = journalBlob({ loads: M, nextSeq: 3 }, [
      { ...journalRecord, loadNo: M },
      { ...journalRecord, seq: 2, intentRef: "intent-2", outcome: "CONFIRMED", code: null, loadNo: M },
    ]);
    sessionStorage.setItem("kix-session-journal", raw);
    for (let page = 0; page < 2; page += 1) {
      const view = await mountRecovery(locale);
      const { container } = view;
      expect(container.querySelector('[data-session-state="unavailable"]')).not.toBeNull();
      expect(container.textContent).toContain(counterCopy[locale]["sj.load"]);
      expect(container.textContent).toContain(counterCopy[locale]["s118"]);
      expect(container.textContent).toContain(counterCopy[locale]["svt"]);
      expect(container.querySelector('[data-kind="history"]')?.getAttribute("data-load")).toBe(`${M}`);
      expect(container.querySelector('[data-kind="unknown"]')).not.toBeNull();
      expect(container.querySelector('[data-kind="this-load"]')).toBeNull();
      const attach = button(container, locale === "en" ? "Attach" : "연결");
      expect(attach.getAttribute("aria-disabled")).toBe("true");
      await click(attach);
      expect(container.querySelector('[data-field="last"]')?.textContent).toContain("COUNTER_EXHAUSTED");
      await dispatch(window, new PageTransitionEvent("pageshow", { persisted: true }));
      expect(sessionStorage.getItem("kix-session-journal")).toBe(raw);
      expect(container.querySelectorAll('[data-outcome="UNKNOWN"]')).toHaveLength(1);
      await view.unmount();
      vi.resetModules();
    }
  });

  it("refuses sequence exhaustion at activation and after reload without allocating an intent", async () => {
    sessionStorage.setItem("kix-session-journal", journalBlob({ nextSeq: M }, []));
    for (let page = 0; page < 2; page += 1) {
      const view = await mountRecovery();
      const before = sessionStorage.getItem("kix-session-journal");
      await click(button(view.container, "Attach"));
      expect(view.container.textContent).toContain(counterCopy.en["sj.seq"]);
      expect(view.container.textContent).toContain("Sent 0 in this load");
      expect(view.container.querySelector('[data-session-state="empty"]')).not.toBeNull();
      expect(view.container.querySelector("[data-outcome]")).toBeNull();
      expect(sessionStorage.getItem("kix-session-journal")).toBe(before);
      await view.unmount();
      vi.resetModules();
    }
  });

  it("quarantines digest-valid unsafe numeric evidence before any activation", async () => {
    sessionStorage.setItem("kix-session-journal", journalBlob({ nextSeq: M + 1 }));
    const { container } = await mountRecovery();
    expect(container.querySelector('[data-session-state="evidence-lost"]')).not.toBeNull();
    expect(button(container, "Attach").getAttribute("aria-disabled")).toBe("true");
    await click(button(container, "Attach"));
    expect(container.textContent).toContain("Sent 0 in this load");
    expect(container.textContent).toContain("CORRUPT");
    expect(sessionStorage.getItem("kix-session-journal-quarantine")).toContain("CORRUPT");
  });
});
