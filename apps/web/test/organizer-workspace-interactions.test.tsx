// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { OrganizerWorkspacePage } from "../src/pages/OrganizerWorkspace";
import { button, change, click, element, renderDom } from "./support/render-dom";

describe("mounted organizer workspace", () => {
  it("edits caller fields, invalidates previews by adding/removing rows, and sends only once", async () => {
    const { container } = await renderDom(<OrganizerWorkspacePage />);
    expect(button(container, "Prepare preview").disabled).toBe(true);
    await change(element(container, "#organizer-ws-event-id"), "coverage-organizer");
    const inputs = container.querySelectorAll<HTMLInputElement>("input");
    for (const [index, value] of [[1, "A1,A2"], [2, "1"], [3, "120"], [4, "coverage-organizer-actor"]] as const) {
      await change(inputs[index]!, value);
    }
    expect(container.textContent).toContain("seats typed: 2");
    await click(button(container, "Add to change list"));
    await click(button(container, "Prepare preview"));
    expect(button(container, "Submit").disabled).toBe(false);
    expect(element(container, ".organizer-ws-preview pre").textContent).toContain('"seats":["A1","A2"]');
    await change(element(container, "select"), "close_sales");
    await click(button(container, "Add to change list"));
    expect(button(container, "Submit").disabled).toBe(true);
    expect(container.textContent).toContain("Prepare preview again");
    await click(button(container, "Prepare preview"));
    await click(button(container, "Remove"));
    expect(button(container, "Submit").disabled).toBe(true);
    await click(button(container, "Prepare preview"));
    await click(button(container, "Submit"));
    expect(container.querySelectorAll('[data-result="RECEIPT"]')).toHaveLength(1);
    expect(document.activeElement?.id).toBe("organizer-ws-results");
    expect(button(container, "Submit").disabled).toBe(true);
    await click(button(container, "Submit"));
    expect(container.querySelectorAll('[data-result="RECEIPT"]')).toHaveLength(1);
  });

  it("keeps empty caller input and focuses the invalid row without sending", async () => {
    const { container } = await renderDom(<OrganizerWorkspacePage />);
    await click(button(container, "Add to change list"));
    await click(button(container, "Prepare preview"));
    expect(element(container, '[role="alert"]').textContent).toContain("Empty event id");
    expect(document.activeElement?.id).toBe("organizer-ws-event-id");
    expect(button(container, "Submit").disabled).toBe(true);
    expect(container.querySelector("[data-result]")).toBeNull();
    await change(element(container, "select"), "issue_invitation");
    const fields = container.querySelectorAll<HTMLInputElement>("input");
    for (const [index, value] of [[1, "organizer"], [2, "inventory"], [3, "0"], [4, "recipient"]] as const) await change(fields[index]!, value);
    expect(fields[2]!.value).toBe("inventory");
    expect(fields[4]!.value).toBe("recipient");
  });
});
