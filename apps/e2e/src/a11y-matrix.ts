import { GALLERY_CHECK_IDS } from "./gallery-matrix";
/**
 * The accessibility observation matrix. App-internal; not a public schema, operation, capability or ID.
 *
 * Facets stay separate on purpose: an automated scan, a keyboard probe, a reflow probe, an assistive-technology run,
 * a user acceptance and a release permission are six different things. None of them stands in for another.
 */

export interface ScreenRow {
  screenId: string;
  /** A concrete path. A parameterised route uses a fixed sample id. */
  path: string;
  /** The route pattern as written in App.tsx. */
  pattern: string;
  label: string;
}

const row = (screenId: string, path: string, label: string, pattern = path): ScreenRow => ({ screenId, path, pattern, label });

/** One row per screen. `/discovery/:rowId` renders the same page as `/discovery` and is not a separate row. */
export const SCREENS: readonly ScreenRow[] = [
  row("box-office", "/", "Box office"),
  row("buyer", "/buyer", "Buyer"),
  row("discovery", "/discovery", "Discover"),
  row("inventory", "/inventory", "Seats and GA"),
  row("platform", "/platform", "Trading platform"),
  row("merchant", "/merchant", "Merchant"),
  row("booking", "/booking/evt_lanterns", "Booking", "/booking/:eventId"),
  row("admission", "/admission", "Admission"),
  row("resale", "/resale", "Resale"),
  row("gift", "/gift", "Gift"),
  row("organizer-workspace", "/organizer/workspace", "Organizer workspace"),
  row("organizer", "/organizer", "Organizer"),
  row("receipts", "/receipts", "Receipts"),
  row("handoff", "/handoff", "Local handoff"),
  row("credit-origination", "/credit/origination", "Credit origination"),
  row("credit-servicing", "/credit/servicing", "Credit servicing"),
  row("credit", "/credit", "Credit"),
  row("finance", "/finance", "Finance"),
  row("marketing", "/marketing", "Marketing"),
  row("marketing-journey", "/marketing/journey", "Benefit journey"),
  row("marketing-m01", "/marketing/m01", "Marketing M01"),
  row("marketing-m02", "/marketing/m02", "Marketing M02"),
  row("marketing-m03", "/marketing/m03", "Marketing M03"),
  row("marketing-m04", "/marketing/m04", "Marketing M04"),
  row("marketing-m05", "/marketing/m05", "Marketing M05"),
  row("assistant", "/assistant", "Assistant"),
  row("permissions", "/permissions", "Permissions"),
  row("notifications", "/notifications", "Notifications"),
  row("provider", "/provider", "Provider journey"),
  row("marketplace-performance", "/marketplace-performance", "Marketplace bench"),
  row("mobile", "/mobile", "Mobile shell"),
  row("qualification", "/qualification", "Qualification"),
  row("release", "/release", "Release"),
  row("identity", "/identity", "Journey context"),
  row("session", "/session", "Session recovery"),
  row("journeys", "/journeys", "Journeys"),
  row("help", "/help", "Help"),
];

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  narrow: { width: 320, height: 568 },
} as const;
export type ViewportName = keyof typeof VIEWPORTS;

/**
 * The automated tool and its configuration. This records what was run. It is NOT a conformance target:
 * `targetStandard` stays UNDETERMINED until the user names one. Changing `version` or `tags` needs a new dated row
 * in the "Baseline change log" table of docs/c-a11y-acceptance-stub-apps-bind.md, with a source check.
 */
export const A11Y_BASELINE = {
  tool: "axe-core",
  version: "4.14.0",
  tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
  targetStandard: "UNDETERMINED",
} as const;

export type ManualFacet = "OBSERVED" | "FINDING" | "NOT_APPLICABLE" | "NOT_RUN";

/** The user acceptance facet has one state. The type has no accepted or rejected value on purpose. */
export interface UserAcceptance {
  state: "PENDING";
  decider: "user";
  baseline: "none";
  evidenceHead: string;
  inheritedFrom: null;
}

export interface ScreenRecord {
  screenId: string;
  path: string;
  automated: Record<ViewportName, { violations: string[]; incomplete: string[] }>;
  keyboard: ManualFacet;
  reflow: ManualFacet;
  structure: ManualFacet;
  assistiveTech: "NOT_RUN";
  userAcceptance: UserAcceptance;
  release: "NOT_AUTHORIZED";
  traceCheckIds: string[];
  outcome: "OBSERVED_WITH_FINDINGS" | "OBSERVED_CLEAN";
}

export interface KnownFinding {
  screenId: string;
  viewport: ViewportName;
  ruleId: string;
  status: "OPEN" | "FIXED";
  note: string;
}

/**
 * Every automated violation the stub shows today. A violation that is not listed fails the run, and a listed OPEN one
 * that no longer shows also fails it (so a fix has to be recorded). Node counts are never asserted.
 * `color-contrast` depends on installed fonts and is exempt from the "no longer shows" check.
 */
const open = (screenId: string, ruleId: string, note: string): KnownFinding[] =>
  (["desktop", "narrow"] as const).map((viewport) => ({ screenId, viewport, ruleId, status: "OPEN" as const, note }));

const single = (screenId: string, viewport: ViewportName, ruleId: string, note: string): KnownFinding => ({ screenId, viewport, ruleId, status: "OPEN", note });

const LANDMARK = "Two or more landmarks of the same role share no distinct name. Markup-only fix (aria-label), not applied in this node.";
const HEADING = "A heading level is skipped. Markup-only fix, not applied in this node.";

export const KNOWN_FINDINGS: readonly KnownFinding[] = [
  ...open("discovery", "nested-interactive", "An interactive control sits inside another interactive widget (listbox option). Not fixed here."),
  ...open("platform", "landmark-unique", LANDMARK),
  ...open("merchant", "heading-order", HEADING),
  ...open("merchant", "landmark-unique", LANDMARK),
  ...open("credit-servicing", "heading-order", HEADING),
  ...open("finance", "landmark-unique", LANDMARK),
  ...open("marketing-journey", "landmark-unique", LANDMARK),
  ...open("provider", "landmark-unique", LANDMARK),
  ...open("mobile", "landmark-unique", LANDMARK),
  single("booking:missing", "desktop", "heading-order", "The unknown-event view starts at a lower heading level than the page expects. Not fixed here."),
  { screenId: "gift:not-sent", viewport: "desktop", ruleId: "form.error-not-linked", status: "FIXED", note: "c-form-validation-ux-stub links local input errors and focuses the summary before the keyboard link moves to the ticket field." },
  { screenId: "gift:not-sent", viewport: "desktop", ruleId: "struct.invalid-unlinked", status: "FIXED", note: "c-form-validation-ux-stub links local input errors and focuses the summary before the keyboard link moves to the ticket field." },
  single("booking", "desktop", "status.disabled-no-reason", "Disabled booking buttons (such as Confirm before a hold) carry no reason that aria-describedby reaches. Not fixed here."),
  single("gift", "desktop", "status.disabled-no-reason", "Disabled gift buttons carry no reason that aria-describedby reaches. Not fixed here."),
  single("inventory:section-page", "desktop", "nested-interactive", "A control sits inside the seat listbox option. Same rule as on /discovery. Not fixed here."),
  { screenId: "handoff", viewport: "narrow", ruleId: "reflow.narrow-overflow", status: "FIXED", note: "At 320px the Startup faults list (an unbreakable VITE_KIX_PROTOCOL_API_BASE token) made the panel grid track wider than the window. Fixed in c-display-preferences-stub: handoff list text wraps anywhere." },
];

export const ENV_SENSITIVE_RULES: readonly string[] = ["color-contrast"];

/** Non-default states the stub reaches today. Each is driven by keys where a key path exists, then probed. */
export const ALT_STATES = [
  { id: "booking:invalid", path: "/booking/evt_lanterns", label: "booking quantity 1.5 (invalid)" },
  { id: "booking:missing", path: "/booking/evt_missing", label: "booking for an unknown event" },
  { id: "discovery:empty", path: "/discovery", label: "discovery with no matching row" },
  { id: "discovery:conflict", path: "/discovery", label: "discovery from-after-to filter conflict" },
  { id: "organizer-workspace:empty-id", path: "/organizer/workspace", label: "organizer workspace with an empty event id" },
  { id: "gift:not-sent", path: "/gift", label: "gift offer not sent (empty body)" },
  { id: "inventory:section-page", path: "/inventory", label: "inventory section page opened by keys" },
  { id: "receipts:empty", path: "/receipts", label: "receipts with no receipt on this load" },
  { id: "journeys:unknown-filter", path: "/journeys", label: "journeys table filtered to Unknown" },
  { id: "session:attach-lost", path: "/session", label: "session attach whose answer is lost" },
  { id: "not-found:unknown-path", path: "/no-such-screen", label: "not-found screen at an unknown address" },
] as const;

export const altCheckId = (altId: string) => `a11y.alt.${altId}`;

export const axeCheckId = (screenId: string, viewport: ViewportName) => `a11y.axe.${screenId}.${viewport}`;
export const reflowCheckId = (screenId: string) => `a11y.reflow.${screenId}`;
export const structCheckId = (screenId: string) => `a11y.struct.${screenId}`;
export const kbdCheckId = (screenId: string) => `a11y.kbd.${screenId}`;

export const STATIC_CHECK_IDS: readonly string[] = [
  "a11y.baseline",
  "a11y.onboarding.first-visit",
  "a11y.onboarding.role-keys",
  "a11y.onboarding.demo-mark",
  "a11y.onboarding.ko",
  "a11y.dialog.not-applicable",
  "a11y.accept.pending",
  "a11y.kbd.tablist.handoff",
  "a11y.kbd.tablist.receipts",
  "a11y.kbd.listbox.discovery",
  "a11y.kbd.listbox.projection",
  "a11y.kbd.listbox.inventory",
  "a11y.kbd.details.journeys",
  "a11y.kbd.escape-noop",
  "a11y.kbd.route-change",
  "a11y.status.disabled-reasons",
  "a11y.shell.title-focus",
  "a11y.shell.not-found-keys",
  "a11y.shell.no-focus-steal",
  "a11y.shell.noscript",
  "a11y.shell.boot-note",
  "a11y.shell.route-fault",
  "a11y.shell.app-fault",
  "a11y.nav.desktop-keys",
  "a11y.nav.menu-keys",
  "a11y.nav.menu-focus",
  "a11y.nav.menu-axe",
  "a11y.nav.breadcrumb",
  "a11y.locale.switch-keys",
  "a11y.locale.persist",
  "a11y.locale.reflow-320",
  "a11y.connectivity.keyboard-cached",
  "a11y.display.dark",
  "a11y.display.forced-colors",
  "a11y.display.reduced-motion",
  "a11y.display.print",
  "a11y.async.read-states",
  "a11y.async.catalogue-empty",
  "a11y.async.unknown-fence",
  "a11y.async.refund-stale",
  "a11y.async.dark",
  "a11y.async.forced-colors",
];

export function expectedCheckIds(): string[] {
  const ids = [...STATIC_CHECK_IDS, ...GALLERY_CHECK_IDS, ...ALT_STATES.map((state) => altCheckId(state.id))];
  for (const screen of SCREENS) {
    ids.push(kbdCheckId(screen.screenId), reflowCheckId(screen.screenId), structCheckId(screen.screenId));
    for (const viewport of Object.keys(VIEWPORTS) as ViewportName[]) {
      ids.push(axeCheckId(screen.screenId, viewport));
    }
  }
  return ids;
}

export function matrixProblems(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const screen of SCREENS) {
    if (ids.has(screen.screenId)) {
      problems.push(`duplicate screen id ${screen.screenId}`);
    }
    ids.add(screen.screenId);
  }
  for (const finding of KNOWN_FINDINGS) {
    if (!ids.has(finding.screenId) && !finding.screenId.includes(":")) {
      problems.push(`finding for unknown screen ${finding.screenId}`);
    }
  }
  return problems;
}

/** Compares what one probe found with KNOWN_FINDINGS. `inScope` limits the vanished check to the probe's own rules. */
export function ratchet(
  screenId: string,
  viewport: ViewportName,
  found: readonly string[],
  inScope: (ruleId: string) => boolean = () => true,
): { unlisted: string[]; vanished: string[] } {
  const open = KNOWN_FINDINGS.filter((item) => item.screenId === screenId && item.viewport === viewport && item.status === "OPEN");
  const openIds = new Set(open.map((item) => item.ruleId));
  const unlisted = [...new Set(found)].filter((id) => !openIds.has(id));
  const foundSet = new Set(found);
  const vanished = open.filter((item) => inScope(item.ruleId) && !foundSet.has(item.ruleId) && !ENV_SENSITIVE_RULES.includes(item.ruleId)).map((item) => item.ruleId);
  return { unlisted, vanished };
}
