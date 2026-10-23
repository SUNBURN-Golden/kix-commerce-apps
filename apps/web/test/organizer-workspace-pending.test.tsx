// @vitest-environment jsdom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { GateRejectedError, ProtocolError } from "@kix/protocol-adapter";
import { OrganizerWorkspacePage } from "../src/pages/OrganizerWorkspace";
import { button, change, click, element, renderDom } from "./support/render-dom";

const transport = vi.hoisted(() => {
  vi.resetModules();
  return { calls: [] as string[], release: null as null | (() => void), error: null as Error | null };
});

// Delay/fail only the existing invoker port; the page, hook, desk and console are real.
vi.mock("../src/organizer-source", async () => {
  const { createStubOrganizerInvoker } = await import("@kix/protocol-adapter");
  const shape = createStubOrganizerInvoker();
  return { organizerSource: { source: "stub-shape", invoker: {
    async invokeLocalCall(input: Parameters<typeof shape.invokeLocalCall>[0]) {
      transport.calls.push(input.action);
      await new Promise<void>((resolve) => { transport.release = resolve; });
      if (transport.error) throw transport.error;
      return shape.invokeLocalCall(input);
    },
  } } };
});

describe("organizer pending batch", () => {
  it.each(["REJECTED", "UNKNOWN"] as const)("blocks duplicate submits and later rows after %s", async (outcome) => {
    transport.calls = [];
    transport.error = outcome === "REJECTED"
      ? new GateRejectedError("Synthetic rejection", "EVENT_EXISTS", { requestId: "request", correlationId: "correlation" }, 422)
      : new ProtocolError("Synthetic lost answer", "REQUEST_TIMEOUT", { requestId: "request", correlationId: "correlation" });
    const { container } = await renderDom(<OrganizerWorkspacePage />);
    await change(element(container, "#organizer-ws-event-id"), `pending-${outcome}`);
    await change(element(container, 'input[placeholder="Comma-separated seat ids"]'), "A1");
    await click(button(container, "Add to change list"));
    await change(element(container, "select"), "close_sales");
    await click(button(container, "Add to change list"));
    await click(button(container, "Prepare preview"));
    const form = element(container, "form");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(transport.calls).toEqual(["create_event"]);
    expect(element<HTMLFieldSetElement>(container, "fieldset").disabled).toBe(true);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(button(container, "Submit").disabled).toBe(true);
    await act(async () => { transport.release!(); });
    expect(container.querySelector(`[data-result="${outcome}"]`)).not.toBeNull();
    expect(container.querySelector('[data-result="NOT_ATTEMPTED"]')).not.toBeNull();
    expect(transport.calls).toEqual(["create_event"]);
    expect(document.activeElement?.id).toBe("organizer-ws-event-id");
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });
});
