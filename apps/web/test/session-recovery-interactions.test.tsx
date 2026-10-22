// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { button, change, click, dispatch, element, renderDom } from "./support/render-dom";

// The production controller intentionally lasts for one page load. Each case is a new load.
beforeEach(() => { vi.resetModules(); });

async function mountRecovery() {
  const { SessionRecoveryPage } = await import("../src/pages/SessionRecovery");
  return renderDom(<MemoryRouter><SessionRecoveryPage /></MemoryRouter>);
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
