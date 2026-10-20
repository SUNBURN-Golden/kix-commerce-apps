import { matchPath } from "react-router-dom";
import { MARKETING_SURFACES } from "../marketing/labels";

/**
 * The one list of routes. App.tsx routes, the grouped nav, the breadcrumb and the page titles are read from it.
 * App-internal; not a public schema, operation, capability or ID. Paths are the react-router patterns the app has always used.
 *
 * Binding words are the workspace registry words, copied here as a type because shell files import no desk module.
 * A test compares them with the workspace registry, so a drift fails there.
 */
export const ROUTE_BINDINGS = ["published-bound", "not-bound", "stub-only", "no-published-command", "planned"] as const;
export type RouteBinding = (typeof ROUTE_BINDINGS)[number];

export const ROUTE_GROUPS = [
  { id: "buyer", label: "Buyer" },
  { id: "organizer", label: "Organizer" },
  { id: "finance", label: "Finance" },
  { id: "credit", label: "Credit" },
  { id: "marketing", label: "Marketing" },
  { id: "platform", label: "Platform" },
  { id: "verification", label: "Verification" },
] as const;
export type RouteGroupId = (typeof ROUTE_GROUPS)[number]["id"];

/**
 * link     a link in the grouped nav.
 * section  no link of its own; the parent link is the current one (the marketing M01-M05 stubs, reached from the hub).
 * hidden   no link and no current mark (needs an event id, so it is reached from a catalogue row).
 */
export type RouteNav = "link" | "section" | "hidden";

export interface RouteEntry {
  id: string;
  /** The react-router pattern. */
  path: string;
  label: string;
  group: RouteGroupId;
  /** The route-level binding word. It equals the binding of the primary surface when there is one. */
  binding: RouteBinding;
  /** The primary workspace surface id, or null when the route has no surface row. */
  surface: string | null;
  /** The breadcrumb parent path, or null. */
  parent: string | null;
  nav: RouteNav;
  /** A concrete path that matches `path`. */
  sample: string;
  /** The a11y matrix screen id, or null when no screen row covers the route. */
  a11y: string | null;
  /** The browser journeys suite id that drives the route, or null. */
  e2e: string | null;
  /** Whether the local evidence matrix has a surface row for this route. */
  evidence: "surface-row" | "none";
  /** Required when `evidence` is "none". */
  note?: string;
}

interface Extras {
  parent?: string;
  nav?: RouteNav;
  sample?: string;
  e2e?: string;
  note?: string;
}

function route<const I extends string>(
  id: I,
  path: string,
  label: string,
  group: RouteGroupId,
  binding: RouteBinding,
  surface: string | null,
  extras: Extras = {},
) {
  return {
    id,
    path,
    label,
    group,
    binding,
    surface,
    parent: extras.parent ?? null,
    nav: extras.nav ?? ("link" as RouteNav),
    sample: extras.sample ?? path,
    a11y: id as string | null,
    e2e: (extras.e2e ?? null) as string | null,
    evidence: (surface === null ? "none" : "surface-row") as "surface-row" | "none",
    ...(extras.note ? { note: extras.note } : {}),
  };
}

const marketingStub = (id: (typeof MARKETING_SURFACES)[number]["id"]) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- id is typed as a member of MARKETING_SURFACES, so the find always succeeds.
  const stub = MARKETING_SURFACES.find((item) => item.id === id)!;
  return route(`marketing-${id.toLowerCase()}` as `marketing-${Lowercase<typeof id>}`, stub.path, `Marketing ${id}`, "marketing", id === "M05" ? "published-bound" : "no-published-command", `marketing-${id.toLowerCase()}`, {
    parent: "/marketing",
    nav: "section",
  });
};

export const ROUTES = [
  route("box-office", "/", "Box office", "buyer", "stub-only", "box-office-catalog", { e2e: "box-office" }),
  route("buyer", "/buyer", "Buyer", "buyer", "stub-only", "buyer-workspace"),
  route("discovery", "/discovery", "Discover", "buyer", "stub-only", "discovery-prototype"),
  route("inventory", "/inventory", "Seats and GA", "buyer", "stub-only", "inventory-venue-select"),
  route("booking", "/booking/:eventId", "Booking", "buyer", "published-bound", "booking-journey", { nav: "hidden", sample: "/booking/evt_lanterns", e2e: "booking" }),
  route("admission", "/admission", "Admission", "buyer", "stub-only", "admission-credential", { e2e: "admission" }),
  route("resale", "/resale", "Resale", "buyer", "stub-only", "resale-desk", { e2e: "resale" }),
  route("gift", "/gift", "Gift", "buyer", "published-bound", "gift-transfer", { e2e: "gift" }),
  route("mobile", "/mobile", "Mobile shell", "buyer", "stub-only", "installable-mobile-shell"),
  route("assistant", "/assistant", "Assistant", "buyer", "stub-only", "delegated-assistant"),

  route("organizer", "/organizer", "Organizer", "organizer", "published-bound", "organizer-console", { e2e: "organizer" }),
  route("organizer-workspace", "/organizer/workspace", "Organizer workspace", "organizer", "published-bound", "organizer-workspace", { parent: "/organizer" }),
  route("merchant", "/merchant", "Merchant", "organizer", "stub-only", "merchant-operations"),

  route("finance", "/finance", "Finance", "finance", "stub-only", "finance-operations"),
  route("provider", "/provider", "Provider journey", "finance", "stub-only", "provider-connected-journey"),

  route("credit", "/credit", "Credit", "credit", "stub-only", "credit-desk", { e2e: "credit" }),
  route("credit-origination", "/credit/origination", "Credit origination", "credit", "stub-only", "credit-origination", { parent: "/credit" }),
  route("credit-servicing", "/credit/servicing", "Credit servicing", "credit", "stub-only", "credit-servicing", { parent: "/credit" }),

  route("marketing", "/marketing", "Marketing", "marketing", "no-published-command", "marketing-hub"),
  route("marketing-journey", "/marketing/journey", "Benefit journey", "marketing", "stub-only", "marketing-journey", { parent: "/marketing" }),
  marketingStub("M01"),
  marketingStub("M02"),
  marketingStub("M03"),
  marketingStub("M04"),
  marketingStub("M05"),

  route("platform", "/platform", "Trading platform", "platform", "stub-only", "platform-journey-trade"),
  route("marketplace-performance", "/marketplace-performance", "Marketplace bench", "platform", "stub-only", "marketplace-performance-bench"),
  route("permissions", "/permissions", "Permissions", "platform", "stub-only", "tenant-permissions"),
  route("notifications", "/notifications", "Notifications", "platform", "stub-only", "notification-inbox"),
  route("identity", "/identity", "Journey context", "platform", "stub-only", "journey-identity"),
  route("session", "/session", "Session recovery", "platform", "stub-only", "session-recovery"),

  route("receipts", "/receipts", "Receipts", "verification", "stub-only", "receipt-explorer", { e2e: "receipts" }),
  route("handoff", "/handoff", "Local handoff", "verification", "stub-only", null, { note: "The handoff packet page is a read-only list of pins and pending producers. It has no workspace surface row, so the evidence matrix has no row for it." }),
  route("journeys", "/journeys", "Journeys", "verification", "stub-only", "cross-surface-journeys"),
  route("qualification", "/qualification", "Qualification", "verification", "stub-only", "platform-operational-qualification"),
  route("release", "/release", "Release", "verification", "stub-only", "platform-release"),
  route("help", "/help", "Help", "verification", "stub-only", null, {
    parent: "/handoff",
    note: "The help page is a glossary copy of the guide documents; it has no workspace surface, so the evidence matrix has no row for it.",
  }),
] as const satisfies readonly RouteEntry[];

export type RouteId = (typeof ROUTES)[number]["id"];

/** Extra route patterns that draw the same page as a registry route. They carry no label, so they cannot repeat one. */
export const ROUTE_ALIASES = [{ path: "/discovery/:rowId", of: "/discovery", sample: "/discovery/row_1" }] as const;

export const NOT_FOUND_LABEL = "Page not found";

type Routes = readonly RouteEntry[];
type Aliases = readonly { path: string; of: string }[];

/** The entry whose pattern (or alias pattern) matches the pathname, or null when the catch-all draws the page. */
export function routeFor(pathname: string, routes: Routes = ROUTES, aliases: Aliases = ROUTE_ALIASES): RouteEntry | null {
  const hit = routes.find((item) => matchPath({ path: item.path, end: true }, pathname));
  if (hit) {
    return hit;
  }
  const alias = aliases.find((item) => matchPath({ path: item.path, end: true }, pathname));
  return alias ? (routes.find((item) => item.path === alias.of) ?? null) : null;
}

/** The path of the one nav link marked current for this pathname, or null. */
export function currentNavPath(pathname: string, routes: Routes = ROUTES): string | null {
  const hit = routeFor(pathname, routes);
  if (!hit || hit.nav === "hidden") {
    return null;
  }
  return hit.nav === "section" ? hit.parent : hit.path;
}

export interface NavGroup {
  id: RouteGroupId;
  label: string;
  links: readonly RouteEntry[];
}

export function navGroups(routes: Routes = ROUTES): NavGroup[] {
  return ROUTE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    links: routes.filter((item) => item.group === group.id && item.nav === "link"),
  }));
}

export interface Crumb {
  label: string;
  /** Null for plain text (the group, and the current page). */
  to: string | null;
  current: boolean;
}

/** Group text, then the parent link, then the current page. A group crumb that repeats the next label is left out. Empty on a path no route matches. */
export function breadcrumbFor(pathname: string, routes: Routes = ROUTES): Crumb[] {
  const hit = routeFor(pathname, routes);
  if (!hit) {
    return [];
  }
  const parent = hit.parent === null ? null : (routes.find((item) => item.path === hit.parent) ?? null);
  const crumbs: Crumb[] = [];
  const groupLabel = ROUTE_GROUPS.find((group) => group.id === hit.group)?.label ?? hit.group;
  const next = parent ? parent.label : hit.label;
  if (groupLabel !== next) {
    crumbs.push({ label: groupLabel, to: null, current: false });
  }
  if (parent) {
    crumbs.push({ label: parent.label, to: parent.path, current: false });
  }
  crumbs.push({ label: hit.label, to: null, current: true });
  return crumbs;
}
