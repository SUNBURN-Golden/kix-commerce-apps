import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App";
import { useId, type ReactNode } from "react";
import { stepLive, useStepOutcome } from "../src/a11y/focus";
import { ConnectivityWriteButton } from "../src/components/ConnectivityWriteButton";
import { RefusalContext } from "../src/connectivity/refusal";
import { AssistantRequest } from "../src/pages/AssistantPanels";
import { CreditPanel } from "../src/pages/CreditPanel";
import { SettlementPanel } from "../src/pages/SettlementPanel";

/**
 * SSR markup for the keyboard outcome fixes (c-plan-d-keyboard-outcome-journeys-stub). Focus moves run in the browser
 * suite (apps/e2e/tests/a11y/keyboard-outcomes.a11y.test.ts); this file pins the markup they rely on.
 */
function renderAt(pathname: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <App />
    </MemoryRouter>,
  );
}

/** The element whose opening tag holds `id="id"`, up to the next close of its tag (for tags that do not nest themselves). */
function element(markup: string, tag: string, id: string): string {
  const at = markup.indexOf(`id="${id}"`);
  const start = at < 0 ? -1 : markup.lastIndexOf(`<${tag} `, at);
  expect(start, `${tag}#${id}`).toBeGreaterThanOrEqual(0);
  const end = markup.indexOf(`</${tag}>`, start);
  return markup.slice(start, end + tag.length + 3);
}

function openingTag(fragment: string): string {
  return fragment.slice(0, fragment.indexOf(">") + 1);
}

const SYNTHETIC_STATUS: readonly [string, string][] = [
  ["/mobile", "mobile-status"],
  ["/assistant", "dlg-status"],
  ["/credit/origination", "origination-status"],
  ["/credit/servicing", "servicing-status"],
  ["/marketing/journey", "mkj-status"],
  ["/merchant", "merchant-status"],
  ["/notifications", "notify-status"],
  ["/platform", "platform-status"],
  ["/provider", "provider-status"],
  ["/permissions", "tenant-status"],
  ["/finance", "finance-status"],
  ["/journeys", "xs-status"],
  ["/qualification", "oq-status"],
  ["/release", "rel-status"],
  ["/marketplace-performance", "mperf-status"],
];

describe("one live region per synthetic status section", () => {
  for (const [path, id] of SYNTHETIC_STATUS) {
    it(`${path}: #${id} is the only polite region, keeps its focus target, and its secondary lines are not announced`, () => {
      const section = element(renderAt(path), "section", id);
      const open = openingTag(section);
      expect(open).toContain('tabindex="-1" aria-live="polite"');
      expect(open).toMatch(/aria-busy="(true|false)"|aria-labelledby/);
      const inner = section.slice(open.length);
      expect(inner).not.toContain('role="status"');
      expect(inner).not.toContain('aria-live="polite"');
      for (const muted of inner.match(/<p class="muted"[^>]*>/g) ?? []) {
        // The bench keeps its last-action line in the announcement; everything else muted is quiet.
        if (id === "mperf-status" && !muted.includes("aria-live")) continue;
        expect(muted, `${id} ${muted}`).toContain('aria-live="off"');
      }
    });
  }

  it("identity and session status regions mark their counters and freshness lines quiet and carry a busy state", () => {
    for (const [path, id] of [["/identity", "identity-status"], ["/session", "session-status"]] as const) {
      const region = element(renderAt(path), "div", id);
      expect(openingTag(region)).toContain('aria-busy="false"');
      // Freshness and counters (identity), load, counters and budget (session) change on every write and stay quiet.
      expect(region.match(/<p class="muted" aria-live="off">/g)?.length ?? 0, id).toBeGreaterThanOrEqual(id === "session-status" ? 3 : 2);
    }
  });
});

describe("refused submits, journey steps and the route note", () => {
  it("every validated form has one empty spoken line that a refused submit fills", () => {
    for (const path of ["/gift", "/organizer", "/organizer/workspace", "/marketing/m01", "/marketing/m05"]) {
      const markup = renderAt(path);
      // Fixed and fully clipped: no layout, still in the accessibility tree.
      expect(markup, path).toContain('<p role="status" data-validation-refused="false" style="position:fixed;clip-path:inset(50%)"></p>');
    }
  });

  it("journey step rows give each status a focus target and describe a locked send by the row note", () => {
    for (const [path, prefix] of [["/booking/evt_lanterns", "journey"], ["/gift", "gift"], ["/organizer", "organizer"], ["/marketing/m05", "consent"]] as const) {
      const markup = renderAt(path);
      const statuses = markup.match(new RegExp(`<div id="${prefix}-[a-z_]+-status" tabindex="-1"`, "g")) ?? [];
      expect(statuses.length, path).toBeGreaterThan(1);
      // Nothing was sent on first paint, so no step row is live yet.
      expect(markup.match(new RegExp(`id="${prefix}-[a-z_]+-status" tabindex="-1" aria-live`, "g")), path).toBeNull();
      for (const tag of markup.match(/<button[^>]*disabled=""[^>]*>Send [a-z_]+/g) ?? []) {
        const ref = tag.match(/aria-describedby="([^"]+)"/)?.[1] ?? "";
        expect(ref, `${path} ${tag}`).toMatch(new RegExp(`^${prefix}-[a-z_]+-note`));
        const note = markup.match(new RegExp(`<p id="${ref.split(" ")[0]}">([^<]+)</p>`))?.[1] ?? "";
        expect(note.trim().length, `${path} ${ref}`).toBeGreaterThan(0);
      }
    }
  });

  it("only the sent step is live, and it is busy while in flight", () => {
    function Probe({ sent }: { sent: boolean }) {
      const outcome = useStepOutcome("probe", [{ step: "create_event", status: "in-flight" }]);
      return <pre>{JSON.stringify([outcome.statusProps("create_event", "in-flight"), outcome.reasonProps("create_event", false, "Waits."), outcome.reasonProps("create_event", true, "Waits."), sent])}</pre>;
    }
    const markup = renderToStaticMarkup(<Probe sent={false} />);
    expect(markup).toContain("{&quot;id&quot;:&quot;probe-create_event-status&quot;,&quot;tabIndex&quot;:-1}");
    expect(markup).toContain("{&quot;aria-describedby&quot;:&quot;probe-create_event-note&quot;},{}");
  });

  it("the shell has one empty route note, announced on a path change and never on first paint", () => {
    const markup = renderAt("/");
    expect(markup.match(/data-route-note=""/g)).toHaveLength(1);
    expect(markup).toContain('<p role="status" data-route-note="" style="position:fixed;clip-path:inset(50%)"></p>');
  });
});

describe("route outcomes and local desks", () => {
  it("the receipt and buyer headings name the outcome section a route change lands on", () => {
    expect(renderAt("/receipts")).toContain('<h2 aria-describedby="receipt-timeline">');
    const buyer = renderAt("/buyer");
    expect(buyer).toContain('<h2 aria-describedby="buyer-evidence">');
    expect(buyer).toMatch(/<p id="refund-buyer-status"[^>]*aria-busy="(true|false)"/);
  });

  it("route insertion adds no competing live notices to receipts, buyer or marketing", () => {
    const receipts = renderAt("/receipts");
    expect(openingTag(element(receipts, "section", "receipt-detail"))).not.toContain("aria-live");
    expect(receipts).not.toMatch(/role="status"[^>]*>The diagnostic/);
    expect(receipts).not.toMatch(/role="status"[^>]*data-async-state="(?:empty|not-bound)"/);
    const buyer = renderAt("/buyer");
    expect(openingTag(element(buyer, "p", "refund-buyer-status"))).not.toContain("role=");
    expect(buyer).toContain('<p class="muted" role="status" aria-busy="true">');
    for (const path of ["/marketing", "/marketing/m02"]) {
      expect(renderAt(path).split('<main id="desk-main"')[1]).not.toContain('<p class="banner" role="status">');
    }
  });

  it("marketing: the hub facts, the M01 card region, the M02 window note, the M03 markers and the M04 count", () => {
    const hub = renderAt("/marketing");
    expect(hub).toContain('<h2 aria-describedby="marketing-session-facts">');
    expect(hub).toContain('<dl id="marketing-session-facts">');
    const m01 = renderAt("/marketing/m01");
    expect(m01).toContain('<div aria-live="polite"><p class="empty" id="m01-card-empty">');
    expect(m01).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="m01-card-empty"[^>]*>Clear demo card/);
    const m02 = renderAt("/marketing/m02");
    expect(m02).toContain('<h2 aria-describedby="m02-window-note">');
    expect(m02).toContain('<p class="muted" id="m02-window-note">');
    expect(renderAt("/marketing/m03")).toContain('<p class="muted" aria-live="polite">');
    expect(renderAt("/marketing/m04")).toMatch(/<div aria-live="polite"><dt>Demo markers<\/dt>/);
  });

  it("discovery: a filter conflict is an alert, and an opened detail is a focus target", () => {
    expect(renderAt("/discovery?from=2030-01-01&to=2020-01-01")).toContain('<p id="discovery-conflict" role="alert">');
    expect(renderAt("/discovery/syn-event-lanterns")).toContain('<article id="discovery-detail" tabindex="-1"');
  });

  it("organizer workspace: one status region, and Prepare and Submit name why they are locked", () => {
    const markup = renderAt("/organizer/workspace");
    expect(markup).toContain('<div id="organizer-ws-status" role="status" aria-live="polite" aria-busy="false">');
    expect(element(markup, "div", "organizer-ws-status")).not.toContain('role="status" aria-live="polite" aria-busy="false" data-async-state');
    expect(markup).toContain('<p id="organizer-ws-empty">');
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="organizer-ws-empty"[^>]*>Prepare preview/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="organizer-ws-empty"[^>]*>Submit/);
  });

  it("mock panels announce their phase and reconcile lines; run tables scroll in their own region", () => {
    const settlement = renderToStaticMarkup(<SettlementPanel eventTitle="North Station Lanterns" view={null} error={null} pending={false} onCommand={() => undefined} onClose={() => undefined} />);
    expect(settlement).toContain('<div aria-live="polite"><dt>Mock phase</dt>');
    expect(settlement).toContain('<div aria-live="polite"><dt>Reconcile matched</dt>');
    expect(renderAt("/credit")).toContain('<div aria-live="polite"><dt>Repaid exposure</dt>');
    expect(renderAt("/resale")).toContain('<div aria-live="polite"><dt>Mock phase</dt>');
    // The run tables render after a run; the browser suite checks them at 360px. Here the region wrapper is pinned.
    for (const file of ["OperationalQualificationPanels", "PlatformReleasePanels"]) {
      const source = readFileSync(new URL(`../src/pages/${file}.tsx`, import.meta.url), "utf8");
      const wrapped = source.match(/<div className="platform-scroll" role="region" aria-label=\{t\("[a-z0-9]+"\)\} tabIndex=\{0\}>\s*<table className="discovery-table"/g) ?? [];
      expect(wrapped.length, file).toBeGreaterThanOrEqual(1);
      expect(source.match(/<table className="discovery-table"/g)?.length, file).toBe(wrapped.length);
    }
    // Long ids and digests in an outcome wrap at 360px (inline, so the initial CSS budget is unchanged).
    const workspace = renderAt("/organizer/workspace");
    expect(workspace).toContain('<fieldset class="organizer-ws-fields" aria-busy="false" style="overflow-wrap:anywhere">');
    expect(workspace).toContain('<div class="panel organizer-ws-results" style="overflow-wrap:anywhere">');
    for (const [file, marker] of [["Receipts", '<dl className="receipt-detail" style={{ overflowWrap: "anywhere" }}>'], ["marketing/M05Consent", 'data-consent-path={model.path.kind} style={{ overflowWrap: "anywhere" }}>'], ["OperationalQualificationPanels", 'aria-label={t("s188")} style={{ overflowWrap: "anywhere" }}>'], ["PlatformReleasePanels", 'aria-label={t("sb9")} style={{ overflowWrap: "anywhere" }}>']]) {
      expect(readFileSync(new URL(`../src/pages/${file}.tsx`, import.meta.url), "utf8"), file).toContain(marker);
    }
  });
});

describe("a refused send is fenced with its reason", () => {
  const noop = () => undefined;
  function Scope({ pressed, children }: { pressed: string | null; children: ReactNode }) {
    return <RefusalContext.Provider value={{ reason: "why", pressed, press: noop, report: noop }}><p id="why">Refused: VERSION_STALE.</p>{children}</RefusalContext.Provider>;
  }
  /** The id the button at this position takes, read by a probe at the same position. */
  function keyAtButton(): string {
    let key = "";
    function Probe() {
      key = useId();
      return null;
    }
    renderToStaticMarkup(<Scope pressed={null}><Probe /></Scope>);
    return key;
  }

  it("the send that was refused is aria-disabled and described by the refusal; another send is not", () => {
    const key = keyAtButton();
    expect(key.length).toBeGreaterThan(0);
    const refused = renderToStaticMarkup(<Scope pressed={key}><ConnectivityWriteButton type="button" aria-describedby="hint">Transfer the right</ConnectivityWriteButton></Scope>);
    expect(refused).toContain('aria-disabled="true" aria-describedby="hint why"');
    const other = renderToStaticMarkup(<Scope pressed="another"><ConnectivityWriteButton type="button">Transfer the right</ConnectivityWriteButton></Scope>);
    expect(other).not.toContain("aria-disabled");
    expect(other).not.toContain("aria-describedby");
  });

  it("mock panels and local forms name their refusal line, and nothing is fenced on first paint", () => {
    const settlement = renderToStaticMarkup(<SettlementPanel eventTitle="North Station Lanterns" view={null} error="INVALID_TRANSITION" pending={false} onCommand={noop} onClose={noop} />);
    expect(settlement).toContain('<p class="alert" role="alert" id="settlement-refusal">');
    expect(settlement).not.toContain('aria-disabled="true"');
    for (const [path, id] of [["/resale", "resale-refusal"], ["/marketing/m03", "coupon-refusal"], ["/marketing/m04", "referral-refusal"]]) {
      const markup = renderAt(path!);
      expect(markup, path).not.toContain(`id="${id}"`);
      expect(markup, path).not.toMatch(/data-connectivity-write="true" aria-disabled="true"/);
    }
    for (const [file, id] of [["Resale", "resale-refusal"], ["marketing/M03Coupons", "coupon-refusal"], ["marketing/M04Rewards", "referral-refusal"], ["AdmissionCredentialPanel", "credential-refusal"], ["CreditPanel", "credit-refusal"]]) {
      const source = readFileSync(new URL(`../src/pages/${file}.tsx`, import.meta.url), "utf8");
      expect(source, file).toContain(`<RefusalScope reason={error ? "${id}" : null}>`);
      expect(source, file).toContain(`role="alert" id="${id}"`);
    }
    for (const file of ["Organizer", "marketing/M05Consent"]) {
      expect(readFileSync(new URL(`../src/pages/${file}.tsx`, import.meta.url), "utf8"), file).toContain("<RefusalScope>");
    }
    expect(readFileSync(new URL("../src/pages/PlatformPanels.tsx", import.meta.url), "utf8")).toContain('<RefusalScope reason={model.lastNeedsFocus ? "platform-last" : null}>');
  });

  it("a denied assistant read fences Ask, described by the status line", () => {
    const actions = { ask: noop } as unknown as Parameters<typeof AssistantRequest>[0]["actions"];
    expect(renderToStaticMarkup(<AssistantRequest actions={actions} fencedBy="dlg-status-line" />)).toMatch(/id="dlg-ask"[^>]*aria-disabled="true" aria-describedby="dlg-status-line"/);
    expect(renderToStaticMarkup(<AssistantRequest actions={actions} />)).not.toMatch(/id="dlg-ask"[^>]*aria-disabled/);
    expect(renderAt("/assistant")).toContain('<p id="dlg-status-line" data-delegation-status=');
  });

  it("Reset is fenced by the session facts only after it emptied the session, never on first paint", () => {
    expect(renderAt("/marketing")).toMatch(/<button[^>]*class="ghost"[^>]*>Reset marketing session/);
    expect(renderAt("/marketing")).not.toMatch(/aria-describedby="marketing-session-facts"[^>]*>Reset marketing session/);
    const source = readFileSync(new URL("../src/pages/marketing/Hub.tsx", import.meta.url), "utf8");
    expect(source).toContain("const empty = reset && !snapshot.membership");
    expect(source).toContain('aria-describedby={empty ? "marketing-session-facts" : undefined}');
  });

  it("one announcement per outcome: no loading line in the credit panel, a busy inventory selection, a ready step stays quiet", () => {
    const credit = renderToStaticMarkup(<CreditPanel eventTitle="North Station Lanterns" view={null} error={null} pending onCommand={noop} />);
    expect(credit).not.toContain('role="status"');
    expect(credit).toContain('<p class="muted"><span');
    // The selection detail renders only after the synthetic read settles, so its source is pinned here.
    expect(readFileSync(new URL("../src/pages/InventoryPanels.tsx", import.meta.url), "utf8")).toContain('<p role="status" aria-busy={model.state === "loading"} data-inventory-status={model.state}>');
    expect(stepLive("create_event", "create_event", "ready")).toEqual({});
    expect(stepLive("create_event", "create_event", "in-flight")).toEqual({ "aria-live": "polite", "aria-busy": true });
    expect(stepLive("create_event", "create_event", "confirmed")).toEqual({ "aria-live": "polite", "aria-busy": false });
    expect(stepLive("create_event", "prepare_trade", "confirmed")).toEqual({});
  });
});
