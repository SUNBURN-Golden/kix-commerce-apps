// @vitest-environment jsdom
import { act, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BuyerPage, BuyerScreen } from "../src/pages/Buyer";
import { PlatformPage, PlatformScreen } from "../src/pages/Platform";
import { MerchantPage } from "../src/pages/Merchant";
import { FinancePage } from "../src/pages/Finance";
import { CreditOriginationPage } from "../src/pages/CreditOrigination";
import { CreditServicingPage } from "../src/pages/CreditServicing";
import { MarketingJourneyPage } from "../src/pages/MarketingJourney";
import { AssistantPage } from "../src/pages/Assistant";
import { TenantPermissionsPage } from "../src/pages/TenantPermissions";
import { NotificationsPage } from "../src/pages/Notifications";
import { JourneyIdentityPage } from "../src/pages/JourneyIdentity";
import { SessionRecoveryPage } from "../src/pages/SessionRecovery";
import { CrossSurfaceJourneysPage } from "../src/pages/CrossSurfaceJourneys";
import { ProviderJourneyPage } from "../src/pages/ProviderJourney";
import { buildBuyerWorkspace } from "../src/buyer-workspace";
import { createJourneyDesk } from "../src/journey-desk";
import { createGiftDesk } from "../src/gift-desk";
import { createStubJourneyInvoker, createStubGiftInvoker, createProtocol, createStubPlatformJourney, PlatformJourneyController } from "@kix/protocol-adapter";
import { useReadState, READ_STATE_PARAMS, type ReadStateScreen } from "../src/shell/read-state-params";
import { App } from "../src/App";
import { renderRoute } from "./support/render-route";
import { change, click, element } from "./support/render-dom";

// Explicit receipt fixtures are supplied on every mount. This is not persistence across a real reload.
const emptyBuyer = buildBuyerWorkspace({ environment: "stub", catalog: { kind: "ready", performances: [] }, selectedEventId: null,
  journey: createJourneyDesk({ protocol: createProtocol({ mode: "stub" }), source: { source: "stub-shape", invoker: createStubJourneyInvoker() } }).getSnapshot(), gift: createGiftDesk({ protocol: createProtocol({ mode: "stub" }), source: { source: "stub-shape", invoker: createStubGiftInvoker() } }).getSnapshot(),
  reservation: null, reservationError: null, resaleRight: null, resaleError: null });
const buyerModel = { ...emptyBuyer, evidence: [
  { kind: "journey-receipt" as const, refId: "evt_fixture", step: "create_event", operationId: "fixture-op-1", status: "confirmed", source: "stub-shape" as const, deskRoute: "/booking/evt_fixture" },
  { kind: "journey-receipt" as const, refId: "evt_fixture", step: "prepare_trade", operationId: "fixture-op-2", status: "confirmed", source: "stub-shape" as const, deskRoute: "/booking/evt_fixture" },
] };
const platformController = new PlatformJourneyController(createStubPlatformJourney({ scenario: "clean" }), { actorRef: "platform-desk" });
await platformController.refresh();
await platformController.run({ step: "book", intentRef: "fixture-1", listingRef: "lst-0001" });
await platformController.refresh();
const platformFixture = platform.buildPlatformModel({ controller: platformController, last: null });
function PlatformFixture() {
  const live = platform.usePlatformJourney();
  return <PlatformScreen live={{ ...live, model: { ...live.model, trades: platformFixture.trades } }} />;
}
const screens: [ReadStateScreen, () => React.ReactNode][] = [
  ["buyer", () => <BuyerScreen model={buyerModel} onReadAgain={vi.fn()} onSelectEvent={vi.fn()} />],
  ["platform", () => <PlatformFixture />], ["merchant", () => <MerchantPage />], ["finance", () => <FinancePage />],
  ["credit-origination", () => <CreditOriginationPage />], ["credit-servicing", () => <CreditServicingPage />],
  ["marketing-journey", () => <MarketingJourneyPage />], ["assistant", () => <AssistantPage />],
  ["permissions", () => <TenantPermissionsPage />], ["notifications", () => <NotificationsPage />],
  ["identity", () => <JourneyIdentityPage />], ["session", () => <SessionRecoveryPage />],
  ["journeys", () => <CrossSurfaceJourneysPage />], ["provider", () => <ProviderJourneyPage />],
];
async function validParams(screen: ReadStateScreen, node: () => React.ReactNode) {
  const view = await renderRoute(node(), `/${screen}`);
  const params = new URLSearchParams();
  for (const { name, nav } of READ_STATE_PARAMS[screen]) {
    if (nav === "push") {
      const select = element<HTMLSelectElement>(view.container, `#read-${name}`);
      const value = Array.from(select.options).find((option) => option.value)?.value;
      expect(value, `${screen}.${name} has a real source option`).toBeTruthy();
      params.set(name, value!);
      await change(select, value!);
      await click(element(view.container, `#read-apply-${name}`));
      expect(view.router.state.historyAction).toBe("PUSH");
    } else {
      const choice = element(view.container, `[data-read-choice="${name}"]`);
      const value = choice.getAttribute("data-read-value")!;
      expect(value).toBeTruthy(); params.set(name, value);
    }
  }
  await view.unmount();
  return params;
}

describe.each(screens)("%s view pointers", (screen, node) => {
  it("restores every selection and filter from an independent mount with the same synthetic sources", async () => {
    const params = await validParams(screen, node);
    const view = await renderRoute(node(), `/${screen}?${params}`);
    for (const { name, nav } of READ_STATE_PARAMS[screen]) {
      if (nav === "push") expect(element<HTMLSelectElement>(view.container, `#read-${name}`).value).toBe(params.get(name));
      else {
        const selected = element(view.container, '[data-read-selected="true"]');
        expect(selected.getAttribute("data-read-id")).toBe(params.get(name));
        expect(selected.getAttribute("aria-current")).toBe("true");
        expect(selected.textContent?.trim().length).toBeGreaterThan(20);
        expect(element(view.container, `[data-read-choice="${name}"][aria-pressed="true"]`)).toBeTruthy();
      }
    }
    expect(view.container.querySelector("[data-read-notice]")).toBeNull();
    expect(view.router.state.location.search).toBe(`?${params}`);
  });
  for (const { name } of READ_STATE_PARAMS[screen]) {
    it.each(["nope", "<script>"])(`${name}: rejects %s, retains a notice after replacing the URL`, async (bad) => {
      const params = await validParams(screen, node); params.set(name, bad);
      const view = await renderRoute(node(), `/${screen}?${params}`);
      expect(new URLSearchParams(view.router.state.location.search).has(name)).toBe(false);
      expect(element(view.container, "[data-read-notice]").textContent).toContain("shared view item is unavailable");
      expect(view.router.state.historyAction).toBe("REPLACE");
      if (READ_STATE_PARAMS[screen].find((param) => param.name === name)?.nav === "replace") expect(view.container.querySelector('[data-read-selected="true"]')).toBeNull();
      expect(view.container.textContent).not.toContain("<script>");
    });
  }
});

it("buyer receipts are unique per step and an unavailable page-load receipt is cleaned without a replay", async () => {
  const restored = await renderRoute(<BuyerScreen model={buyerModel} onReadAgain={vi.fn()} onSelectEvent={vi.fn()} />, "/buyer?receipt=journey-receipt:evt_fixture:prepare_trade");
  expect(element(restored.container, '[data-read-selected="true"]').textContent).toContain("prepare_trade");
  expect(restored.container.querySelectorAll('[data-read-selected="true"]')).toHaveLength(1);
  await restored.unmount();
  const fresh = await renderRoute(<BuyerPage />, "/buyer?receipt=journey-receipt:evt_fixture:prepare_trade");
  expect(fresh.router.state.location.search).toBe("");
  expect(element(fresh.container, "[data-read-notice]")).toBeTruthy();
  expect(fresh.container.querySelector('[data-read-selected="true"]')).toBeNull();
  // Buyer refund variant is intentionally read-only; adding write controls would expand its authority.
  expect(fresh.container.querySelector('[data-connectivity-write="true"]')).toBeNull();
});

it("finance categories filter actual cases, and an incompatible selection is removed", async () => {
  const view = await renderRoute(<FinancePage />);
  const choices = Array.from(element<HTMLSelectElement>(view.container, "#read-queue").options).map((option) => option.value).filter(Boolean);
  expect(choices.length).toBeGreaterThan(1);
  await change(element(view.container, "#read-queue"), choices[0]!);
  expect(view.router.state.location.search).toBe("");
  await click(element(view.container, "#read-apply-queue"));
  const rows = Array.from(view.container.querySelectorAll("li[data-case]"));
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) expect(row.getAttribute("data-category")).toBe(choices[0]);
  const selected = element(view.container, '[data-read-choice="case"]'); await click(selected);
  expect(view.router.state.historyAction).toBe("REPLACE");
  await change(element(view.container, "#read-queue"), choices[1]!); await click(element(view.container, "#read-apply-queue"));
  expect(view.router.state.historyAction).toBe("PUSH");
  expect(new URLSearchParams(view.router.state.location.search).has("case")).toBe(false);
});

it("search restoration preserves focus through the real shell and path navigation focuses the heading", async () => {
  const view = await renderRoute(<App />, "/finance");
  await vi.waitFor(() => expect(view.container.querySelector("#finance-status")).not.toBeNull());
  const input = element<HTMLInputElement>(view.container, "#finance-note");
  input.focus();
  const value = element(view.container, '[data-read-choice="case"]').getAttribute("data-read-value")!;
  await act(async () => view.router.navigate(`/finance?case=${value}`));
  expect(document.activeElement).toBe(input);
  expect(element(view.container, '[data-read-selected="true"]').getAttribute("data-read-id")).toBe(value);
  await act(async () => view.router.navigate("/notifications"));
  await vi.waitFor(() => expect(view.container.querySelector("#notify-status")).not.toBeNull());
  expect(document.activeElement).toBe(element(view.container, "main h2"));
});

// Observe real page action entrypoints. Each control gets a fresh source, so a prior
// write cannot disable the next control or make a no-op look like coverage.
import * as platform from "../src/platform-journey";
import * as merchant from "../src/merchant-operations";
import * as finance from "../src/finance-operations";
import * as origination from "../src/credit-origination";
import * as servicing from "../src/credit-servicing";
import * as marketing from "../src/marketing-journey";
import * as assistant from "../src/delegated-assistant";
import * as permissions from "../src/tenant-permissions";
import * as notifications from "../src/notification-inbox";
import * as identity from "../src/journey-identity";
import * as session from "../src/session-recovery";
import * as journeys from "../src/cross-surface-journeys";
import * as provider from "../src/provider-journey";
const actionHooks: Partial<Record<ReadStateScreen, [any, string]>> = {
  platform: [platform, "usePlatformJourney"], merchant: [merchant, "useMerchantOperations"],
  finance: [finance, "useFinanceOperations"], "credit-origination": [origination, "useCreditOrigination"],
  "credit-servicing": [servicing, "useCreditServicing"], "marketing-journey": [marketing, "useMarketingJourney"],
  assistant: [assistant, "useDelegationAssistant"], permissions: [permissions, "useTenantPermissions"],
  notifications: [notifications, "useNotificationInbox"], identity: [identity, "useJourneyIdentityDesk"],
  session: [session, "useSessionRecoveryDesk"], journeys: [journeys, "useCrossSurfaceJourneys"],
  provider: [provider, "useProviderJourney"],
};
function observeActions(screen: ReadStateScreen) {
  const [module, name] = actionHooks[screen]!;
  const hook = module[name];
  const calls: string[] = [];
  const spy = vi.spyOn(module, name).mockImplementation(() => {
    const live = hook();
    return { ...live, actions: Object.fromEntries(Object.entries(live.actions).map(([key, fn]) => [key, (...args: unknown[]) => {
      calls.push(key);
      // jsdom cannot navigate a document. The existing Chrome session check covers a real reload.
      if (key !== "reloadPage") return (fn as (...args: unknown[]) => unknown)(...args);
    }])) };
  });
  return { calls, spy };
}
const writeSelector = 'button[data-connectivity-write="true"]:not([aria-disabled]):not(:disabled), button[id*="apply-scenario"]';
for (const [screen, node] of screens.filter(([id]) => id !== "buyer")) {
  it(`${screen}: restoring a link invokes no page action; each enabled write/attach/scenario control leaves the URL unchanged`, async () => {
    const params = await validParams(screen, node);
    let observed = observeActions(screen);
    const entry = screen === "platform" ? "/platform?channel=web-board" : `/${screen}?${params}`;
    const writeNode = screen === "platform" ? () => <PlatformPage /> : node;
    let view = await renderRoute(writeNode(), entry);
    expect(observed.calls).toEqual([]);
    const controlSelector = screen === "session" ? `${writeSelector}, button` : writeSelector;
    const controls = Array.from(view.container.querySelectorAll<HTMLButtonElement>(controlSelector)).filter((button) => screen !== "session" || button.matches(writeSelector) || button.textContent?.trim() === "Reload this page").map((button) => ({ id: button.id, label: button.textContent?.trim() }));
    // Merchant has no synthetic write; its source/scenario controls are reads.
    if (screen !== "merchant" && screen !== "journeys") expect(controls.length).toBeGreaterThan(0);
    await view.unmount();
    for (const control of controls) {
      if (screen === "session") {
        observed.spy.mockRestore();
        vi.resetModules();
        const freshSession = await import("../src/session-recovery");
        const freshPage = await import("../src/pages/SessionRecovery");
        actionHooks.session = [freshSession, "useSessionRecoveryDesk"];
        observed = observeActions(screen);
        view = await renderRoute(<freshPage.SessionRecoveryPage />, entry);
      } else view = await renderRoute(writeNode(), entry);
      observed.calls.length = 0;
      const target = Array.from(view.container.querySelectorAll<HTMLButtonElement>(controlSelector)).find((button) => control.id ? button.id === control.id : button.textContent?.trim() === control.label);
      expect(target, `${screen}: ${control.id || control.label} enabled on independent fixture`).toBeTruthy();
      const before = view.router.state.location.search;
      if (control.id === "dlg-ask") await change(element(view.container, "#dlg-request-text"), "Show my benefit eligibility");
      await click(target!);
      await act(async () => { await Promise.resolve(); });
      expect(observed.calls.length, `${screen}: ${control.id || control.label} ran its action`).toBeGreaterThan(0);
      expect(view.router.state.location.search).toBe(before);
      await view.unmount();
    }
    observed.spy.mockRestore();
  });
}

it("permissions views intersect every resource family without switching the active role or actor", async () => {
  const observed = observeActions("permissions");
  const view = await renderRoute(<TenantPermissionsPage />, "/permissions?workspace=buyer");
  expect(observed.calls).toEqual([]);
  expect(element<HTMLSelectElement>(view.container, "#tenant-role").value).toBe("organizer");
  expect(element<HTMLSelectElement>(view.container, "#tenant-actor").value).toBe("person-organizer");
  // The organizer snapshot cannot supply buyer orders, settler accounts or support cases.
  expect(view.container.querySelector("#tenant-workspace [data-order]")).toBeNull();
  expect(view.container.querySelector("#tenant-workspace [data-event]")).toBeNull();
  expect(view.container.querySelector("#tenant-workspace [data-account]")).toBeNull();
  expect(view.container.querySelector("#tenant-workspace [data-case]")).toBeNull();
  expect(view.router.state.location.search).toBe("?workspace=buyer");
});

it("a platform trade created on another page load is unavailable after a fresh source read", async () => {
  const view = await renderRoute(<PlatformPage />, "/platform?channel=web-board&trade=trd-0001");
  expect(view.router.state.location.search).toBe("?channel=web-board");
  expect(element(view.container, "[data-read-notice]")).toBeTruthy();
});

function ReadTimingFixture() {
  const [domain, setDomain] = useState<readonly string[] | null>(null);
  const read = useReadState("finance", { case: domain });
  return <>
    <output data-validated={read.values.case}>{read.notice ? "invalid link" : "view"}</output>
    <button type="button" id="settle-read" onClick={() => setDomain(["case-1"])}>settle read</button>
    <button type="button" id="source-write" onClick={() => setDomain([])}>change source</button>
    <button type="button" id="unlisted" onClick={() => read.set("actor", "person")}>unlisted</button>
  </>;
}
it("cleans syntax before a read settles, defers membership, and never cleans again because a write removes a row", async () => {
  const view = await renderRoute(<ReadTimingFixture />, "/finance?case=case-1&actor=person&junk=%3Cscript%3E&lang=KO");
  expect(view.router.state.location.search).toBe("?case=case-1");
  expect(element(view.container, "output").getAttribute("data-validated")).toBeNull();
  await click(element(view.container, "#settle-read"));
  expect(element(view.container, "output").getAttribute("data-validated")).toBe("case-1");
  expect(element(view.container, "output").textContent).toBe("invalid link");
  await click(element(view.container, "#source-write"));
  expect(view.router.state.location.search).toBe("?case=case-1");
  expect(element(view.container, "output").getAttribute("data-validated")).toBeNull();
  await click(element(view.container, "#unlisted"));
  expect(view.router.state.location.search).toBe("?case=case-1");
  await act(async () => view.router.navigate("/finance?case=bad"));
  expect(view.router.state.location.search).toBe("");
  expect(view.router.state.historyAction).toBe("REPLACE");
  await act(async () => view.router.navigate("/finance"));
  expect(element(view.container, "output").textContent).toBe("view");
});

it("defers membership of an unknown id until its source settles, then cleans it once", async () => {
  const view = await renderRoute(<ReadTimingFixture />, "/finance?case=bad");
  expect(view.router.state.location.search).toBe("?case=bad");
  expect(element(view.container, "output").textContent).toBe("view");
  await click(element(view.container, "#settle-read"));
  expect(view.router.state.location.search).toBe("");
  expect(element(view.container, "output").textContent).toBe("invalid link");
});

it.each(["application", "review", "commitment", "drawdown"])("origination restores the %s lane with the actual application pointer", async (lane) => {
  const view = await renderRoute(<CreditOriginationPage />, `/credit/origination?lane=${lane}`);
  expect(element<HTMLSelectElement>(view.container, "#read-lane").value).toBe(lane);
  expect(element(view.container, "[data-application]").textContent).toContain("app-");
  for (const other of ["review", "commitment", "drawdown"]) expect(view.container.querySelector(`[data-read-lane="${other}"]`) !== null).toBe(lane === other);
});
it.each(["draw", "reservation", "exposure", "schedule", "payment", "case", "proposal"])("servicing restores the %s lane without changing the obligation authority", async (lane) => {
  const observed = observeActions("credit-servicing");
  const view = await renderRoute(<CreditServicingPage />, `/credit/servicing?lane=${lane}`);
  expect(element<HTMLSelectElement>(view.container, "#read-lane").value).toBe(lane);
  expect(element(view.container, `[data-read-lane="${lane}"]`).textContent!.trim().length).toBeGreaterThan(5);
  expect(observed.calls).toEqual([]);
});

for (const [screen, node] of screens.filter(([id]) => id !== "buyer" && id !== "session")) {
  it(`${screen}: applying a different source scenario leaves a validated URL intact`, async () => {
    const params = await validParams(screen, node);
    const observed = observeActions(screen);
    const view = await renderRoute(node(), `/${screen}?${params}`);
    const select = Array.from(view.container.querySelectorAll<HTMLSelectElement>("select")).find((select) => Array.from(select.options).some((option) => option.value === "clean"));
    expect(select, `${screen} scenario picker`).toBeTruthy();
    const next = Array.from(select!.options).find((option) => option.value !== "clean")!.value;
    const before = view.router.state.location.search;
    await change(select!, next);
    if (observed.calls.length) {
      expect(observed.calls).toContain("setScenario");
      expect(view.router.state.location.search).toBe(before);
      return;
    }
    const apply = Array.from(view.container.querySelectorAll<HTMLButtonElement>('button[data-connectivity-write="true"], button[id*="apply-scenario"]')).find((button) => /scenario/i.test(button.textContent ?? ""));
    expect(apply).toBeTruthy();
    expect(apply!.disabled).toBe(false);
    await click(apply!);
    expect(observed.calls.some((call) => call === "setScenario" || call === "applyScenario")).toBe(true);
    expect(view.router.state.location.search).toBe(before);
  });
}

it.each([
  ["buyer", "person-buyer", "order"], ["organizer", "person-organizer", "event"],
  ["settler", "person-settler", "account"], ["support", "person-support", "case"],
])("permissions: %s snapshot stays authorized while workspace pointers filter resource kinds", async (role, actor, resource) => {
  const view = await renderRoute(<TenantPermissionsPage />, "/permissions");
  await change(element(view.container, "#tenant-actor"), actor!); await click(element(view.container, "#tenant-apply-actor"));
  await change(element(view.container, "#tenant-role"), role!); await click(element(view.container, "#tenant-apply-role"));
  const rowsBefore = view.container.querySelectorAll(`#tenant-workspace [data-${resource}]`).length;
  expect(rowsBefore, `${role} has actual ${resource} content`).toBeGreaterThan(0);
  const memberCount = view.container.querySelectorAll(`#tenant-workspace [data-member]`).length;
  expect(memberCount).toBeGreaterThan(0);
  const observed = observeActions("permissions");
  await act(async () => view.router.navigate(`/permissions?workspace=${role}`));
  expect(view.container.querySelectorAll(`#tenant-workspace [data-${resource}]`).length).toBe(rowsBefore);
  const other = role === "buyer" ? "organizer" : "buyer";
  await act(async () => view.router.navigate(`/permissions?workspace=${other}`));
  expect(view.container.querySelectorAll(`#tenant-workspace [data-${resource}]`)).toHaveLength(0);
  expect(element<HTMLSelectElement>(view.container, "#tenant-role").value).toBe(role);
  expect(element<HTMLSelectElement>(view.container, "#tenant-actor").value).toBe(actor);
  expect(observed.calls).toEqual([]);
});

it("session: scenario application and recovery reload controls leave an item pointer unchanged", async () => {
  vi.resetModules();
  const freshSession = await import("../src/session-recovery");
  const freshPage = await import("../src/pages/SessionRecovery");
  actionHooks.session = [freshSession, "useSessionRecoveryDesk"];
  const observed = observeActions("session");
  const view = await renderRoute(<freshPage.SessionRecoveryPage />, "/session?item=obs-0001");
  expect(observed.calls).toEqual([]);
  const before = view.router.state.location.search;
  const select = element<HTMLSelectElement>(view.container, 'select[aria-label="Scenario"]');
  await change(select, "attach-lost");
  const apply = Array.from(view.container.querySelectorAll<HTMLButtonElement>('button[data-connectivity-write="true"]')).find((button) => button.textContent?.includes("scenario"))!;
  expect(apply.disabled).toBe(false);
  await click(apply);
  expect(observed.calls).toEqual(["setScenario"]);
  expect(view.router.state.location.search).toBe(before);
  observed.calls.length = 0;
  await click(element(view.container, "#session-attach-obs-0001"));
  expect(observed.calls).toEqual(["attach"]);
  expect(element(view.container, "#session-status").textContent).toMatch(/unknown/i);
  expect(view.router.state.location.search).toBe(before);
  const reload = Array.from(view.container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Reload this page")!;
  await click(reload);
  expect(observed.calls).toEqual(["attach", "reloadPage"]);
  expect(view.router.state.location.search).toBe(before);
});

it("platform: booking, transfer and new-session writes preserve a selected trade URL even when the source removes the trade", async () => {
  const observed = observeActions("platform");
  const view = await renderRoute(<PlatformPage />, "/platform?channel=web-board");
  expect(observed.calls).toEqual([]);
  await click(element(view.container, 'button[id^="platform-book-"]:not([aria-disabled])'));
  expect(observed.calls).toContain("book");
  expect(element(view.container, "[data-last-action]").textContent).toMatch(/confirmed/i);
  await click(element(view.container, '[data-read-choice="trade"]'));
  const before = view.router.state.location.search;
  expect(new URLSearchParams(before).get("trade")).toBeTruthy();
  await click(element(view.container, 'button[id^="platform-transfer-"]:not([aria-disabled])'));
  expect(observed.calls).toContain("transfer");
  expect(element(view.container, "[data-last-action]").textContent).toMatch(/confirmed/i);
  expect(view.router.state.location.search).toBe(before);
  await click(element(view.container, "#platform-new-session"));
  expect(observed.calls).toContain("newSession");
  expect(view.container.querySelector('[data-read-selected="true"]')).toBeNull();
  expect(view.container.querySelector("[data-read-notice]")).toBeNull();
  expect(view.router.state.location.search).toBe(before);
});

it("finance: a real maker proposal and checker approval keep the selected case URL", async () => {
  const observed = observeActions("finance");
  const params = await validParams("finance", () => <FinancePage />);
  observed.calls.length = 0;
  const view = await renderRoute(<FinancePage />, `/finance?${params}`);
  expect(observed.calls).toEqual([]);
  const before = view.router.state.location.search;
  await click(element(view.container, 'button[id^="finance-propose-"]:not([aria-disabled])'));
  await click(element(view.container, "#finance-refresh"));
  expect(view.container.querySelector("[data-proposal]")).not.toBeNull();
  expect(view.router.state.location.search).toBe(before);
  await change(element(view.container, "#finance-actor"), "finance-approver");
  await click(element(view.container, "#finance-apply-actor"));
  await click(element(view.container, 'button[id^="finance-approve-"]:not([aria-disabled])'));
  await click(element(view.container, "#finance-refresh"));
  expect(view.container.querySelector('[data-proposal-state="approval-recorded"]')).not.toBeNull();
  expect(view.router.state.location.search).toBe(before);
});


it("filter application and history restoration preserve the focused control through the real shell", async () => {
  const view = await renderRoute(<App />, "/finance");
  const select = element<HTMLSelectElement>(view.container, "#read-queue");
  const apply = element<HTMLButtonElement>(view.container, "#read-apply-queue");
  const next = Array.from(select.options).find((option) => option.value)!.value;
  await change(select, next);
  apply.focus();
  await click(apply);
  expect(document.activeElement).toBe(apply);
  expect(view.router.state.historyAction).toBe("PUSH");
  await act(async () => view.router.navigate(-1));
  expect(document.activeElement).toBe(apply);
  expect(select.value).toBe("");
  await act(async () => view.router.navigate(1));
  expect(document.activeElement).toBe(apply);
  expect(select.value).toBe(next);
});
