// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { FinancePage } from "../src/pages/Finance";
import { TenantPermissionsPage } from "../src/pages/TenantPermissions";
import { NotificationsPage } from "../src/pages/Notifications";
import { change, click, element, renderDom } from "./support/render-dom";

async function apply(container: HTMLElement, prefix: string, field: string, value: string) {
  await change(element(container, `#${prefix}-${field}`), value);
  await click(element(container, `#${prefix}-apply-${field}`));
}

describe("mounted synthetic operations desks", () => {
  it("records a finance proposal and separate checker approval, with export and scope fences", async () => {
    const { container } = await renderDom(<MemoryRouter><FinancePage /></MemoryRouter>);
    expect(element(container, "#finance-status").getAttribute("data-finance-state")).toBe("ready");
    const proposedBefore = container.querySelectorAll("[data-proposal]").length;
    await click(element(container, 'button[id^="finance-propose-"]:not([aria-disabled])'));
    await click(element(container, "#finance-refresh"));
    expect(container.querySelectorAll("[data-proposal]").length).toBe(proposedBefore + 1);
    expect(element(container, "[data-last-action]").textContent).toContain("proposal");
    await apply(container, "finance", "actor", "finance-approver");
    await click(element(container, 'button[id^="finance-approve-"]:not([aria-disabled])'));
    await click(element(container, "#finance-refresh"));
    expect(container.querySelector('[data-proposal-state="approval-recorded"]')).not.toBeNull();
    expect(container.textContent).toContain("changes no economic state");
    await click(element(container, "#finance-export"));
    expect(element(container, "#finance-export-panel").getAttribute("data-export-phase")).toBe("loaded");
    await click(element(container, "#finance-advance"));
    expect(element(container, "[data-last-action]").textContent).toContain("next cut");
    await click(element(container, "#finance-refresh"));
    await click(element(container, "#finance-post-correction"));
    expect(element(container, "[data-last-action]").textContent).toContain("later cut");
    await click(element(container, "#finance-new-session"));
    expect(element(container, "#finance-export-panel").getAttribute("data-export-phase")).toBe("none");
    await click(element(container, "#finance-switch"));
    expect(element(container, "#finance-status").getAttribute("data-finance-state")).toBe("denied");
    expect(document.activeElement?.id).toBe("finance-status");
    await click(element(container, "#finance-switch"));
    await click(element(container, "#finance-revoke"));
    await click(element(container, "#finance-refresh"));
    expect(element(container, "#finance-status").getAttribute("data-finance-state")).toBe("denied");
  });

  it("applies a scenario only on request and renders the finance empty and refused states", async () => {
    const { container } = await renderDom(<MemoryRouter><FinancePage /></MemoryRouter>);
    await change(element(container, "#finance-scenario"), "empty");
    expect(element(container, "#finance-status").getAttribute("data-finance-state")).toBe("ready");
    await click(element(container, "#finance-apply-scenario"));
    expect(element(container, "#finance-status").getAttribute("data-finance-state")).toBe("empty");
    await apply(container, "finance", "scenario", "stale");
    expect(element(container, "#finance-status").getAttribute("data-finance-state")).toBe("stale");
    await click(element(container, "#finance-return-action"));
    expect(element(container, "#finance-status").getAttribute("data-finance-state")).toBe("stale");
  });

  it("denies foreign resource opens and records tenant maker/checker changes separately", async () => {
    const { container } = await renderDom(<TenantPermissionsPage />);
    await click(element(container, "#tenant-open-ref"));
    expect(element(container, "[data-last-action]").textContent).toContain("never guessed");
    await change(element(container, "#tenant-focus-ref"), "acc-9999");
    await click(element(container, "#tenant-open-ref"));
    expect(element(container, "#tenant-status").getAttribute("data-tenant-state")).toBe("denied");
    await apply(container, "tenant", "actor", "person-organizer");
    await apply(container, "tenant", "role", "organizer");
    expect(element(container, "#tenant-status").getAttribute("data-tenant-state")).toBe("ready");
    await click(element(container, "#tenant-new-session"));
    await apply(container, "tenant", "actor", "person-support");
    await apply(container, "tenant", "role", "support");
    await click(element(container, 'button[id^="tenant-revoke-"]:not([aria-disabled])'));
    await click(element(container, "#tenant-refresh"));
    await apply(container, "tenant", "actor", "person-settler");
    await apply(container, "tenant", "role", "settler");
    await click(element(container, 'button[id^="tenant-account-"]:not([aria-disabled])'));
    await click(element(container, "#tenant-refresh"));
    expect(container.querySelectorAll("[data-proposal]").length).toBeGreaterThanOrEqual(2);
    await apply(container, "tenant", "actor", "person-organizer");
    await apply(container, "tenant", "role", "organizer");
    await click(element(container, 'button[id^="tenant-approve-"]:not([aria-disabled])'));
    await click(element(container, "#tenant-refresh"));
    expect(container.querySelector('[data-proposal-state="approval-recorded"]')).not.toBeNull();
    await apply(container, "tenant", "actor", "person-settler");
    await apply(container, "tenant", "role", "settler");
    await click(element(container, "#tenant-export"));
    expect(element(container, "#tenant-export-panel").getAttribute("data-export-phase")).toBe("loaded");
    await click(element(container, "#tenant-switch-tenant"));
    expect(element(container, "#tenant-status").getAttribute("data-tenant-state")).toBe("denied");
    await click(element(container, "#tenant-switch-tenant"));
    await click(element(container, "#tenant-refresh"));
    await click(element(container, "#tenant-new-session"));
    expect(element(container, "#tenant-export-panel").getAttribute("data-export-phase")).toBe("none");
    await apply(container, "tenant", "scenario", "empty");
    expect(element(container, "#tenant-status").getAttribute("data-tenant-state")).toBe("empty");
  });

  it("marks an inbox row read and resolves offered support material without an external send", async () => {
    const { container } = await renderDom(<MemoryRouter><NotificationsPage /></MemoryRouter>);
    expect(element(container, "#notify-status").getAttribute("data-notify-state")).toBe("ready");
    const row = element(container, "[data-notification]");
    const ref = row.getAttribute("data-notification")!;
    await click(element(row, 'button[id^="notify-mark-"]'));
    await click(element(container, "#notify-refresh"));
    expect(element(container, `[data-notification="${ref}"]`).getAttribute("data-notification-read")).toBe("true");
    await click(element(container, 'button[id^="notify-resolve-"]:not([aria-disabled])'));
    expect(element(container, "[data-last-action]").textContent).toContain("destination, not a send");
    await click(element(container, "#notify-open-ref"));
    expect(element(container, "[data-last-action]").textContent).toContain("never guessed");
    await change(element(container, "#notify-focus-ref"), ref);
    await click(element(container, "#notify-open-ref"));
    expect(element(container, "#notify-focus").textContent).toContain(ref);
    await click(element(container, "#notify-deliver-late"));
    await click(element(container, "#notify-refresh"));
    expect(element(container, "[data-last-action]").textContent).toContain("older grant generation");
    await click(element(container, "#notify-rotate-grant"));
    expect(element(container, "[data-last-action]").textContent).toContain("moved a generation");
    await click(element(container, "#notify-revoke-grant"));
    await click(element(container, "#notify-refresh"));
    expect(element(container, "#notify-status").getAttribute("data-notify-state")).toBe("denied");
    await click(element(container, "#notify-new-session"));
    await apply(container, "notify", "actor", "person-support");
    await apply(container, "notify", "role", "support");
    expect(element(container, "#notify-status").getAttribute("data-notify-state")).toBe("ready");
    await click(element(container, 'button[id^="notify-resolve-"]:not([aria-disabled])'));
    await click(element(container, "#notify-open-inquiry"));
    expect(element(container, "#notify-inquiry").getAttribute("data-inquiry-phase")).toBe("loaded");
    await click(element(container, "#notify-switch-tenant"));
    expect(element(container, "#notify-status").getAttribute("data-notify-state")).toBe("denied");
    await click(element(container, "#notify-switch-tenant"));
    await apply(container, "notify", "scenario", "empty");
    expect(element(container, "#notify-status").getAttribute("data-notify-state")).toBe("empty");
  });
});
