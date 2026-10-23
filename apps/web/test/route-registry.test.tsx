import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { Breadcrumb } from "../src/components/Breadcrumb";
import { MARKETING_SURFACES } from "../src/marketing/labels";
import { NotFoundPage } from "../src/pages/NotFound";
import {
  APP_ROUTES,
  ROUTE_ALIASES,
  ROUTE_BINDINGS,
  ROUTE_GROUPS,
  ROUTES,
  breadcrumbFor,
  currentNavPath,
  navGroups,
  routeFor,
  type RouteEntry,
} from "../src/shell/route-registry";
import { SURFACE_BINDINGS, WORKSPACE_SURFACES } from "../src/workspace/registry";
import { SCREENS as A11Y_SCREENS } from "../../e2e/src/a11y-matrix";
import { E2E_ROUTE } from "./support/local-evidence-matrix";
import { matrixDriftProblems, registryRows, routeRegistryProblems } from "./support/route-registry-checks";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "..");
const root = path.resolve(web, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const page = (pathname: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <App />
    </MemoryRouter>,
  );
const surfacesNav = (html: string) => html.match(/<nav aria-label="Surfaces">.*?<\/nav>/s)?.[0] ?? "";
const crumbNav = (html: string) => html.match(/<nav aria-label="Breadcrumb">.*?<\/nav>/s)?.[0] ?? "";
const countOf = (text: string, needle: string) => text.split(needle).length - 1;

/** The URLs the app answered before the registry existed (App.tsx on main at the base of this node). A path may be added; none may go. */
const LEGACY_PATTERNS = [
  "/", "/buyer", "/discovery", "/discovery/:rowId", "/inventory", "/platform", "/merchant", "/booking/:eventId", "/admission", "/resale", "/gift",
  "/organizer/workspace", "/organizer", "/receipts", "/handoff", "/credit/origination", "/credit/servicing", "/credit", "/finance", "/marketing",
  "/marketing/journey", "/marketing/m01", "/marketing/m02", "/marketing/m03", "/marketing/m04", "/marketing/m05", "/assistant", "/permissions",
  "/notifications", "/provider", "/marketplace-performance", "/mobile", "/qualification", "/release", "/identity", "/session", "/journeys",
  "/help",
];

describe("registry structure", () => {
  it("has no problem as shipped", () => {
    expect(routeRegistryProblems(ROUTES, ROUTE_ALIASES)).toEqual([]);
  });

  it("fails on a repeated path, label or id, an unknown group, an empty group, a dangling parent or a sample that does not resolve", () => {
    const first = ROUTES[0]!;
    const second = ROUTES[1]!;
    const copy = (change: (items: RouteEntry[]) => void) => {
      const items: RouteEntry[] = ROUTES.map((item) => ({ ...item }));
      change(items);
      return routeRegistryProblems(items, ROUTE_ALIASES);
    };
    expect(copy((items) => items.push({ ...items[1]!, id: "extra", label: "Extra" }))).toContainEqual(`duplicate path ${second.path}`);
    expect(copy((items) => items.push({ ...items[1]!, id: "extra", path: "/extra", sample: "/extra" }))).toContainEqual(`duplicate label ${second.label}`);
    expect(copy((items) => items.push({ ...items[1]!, path: "/extra", sample: "/extra", label: "Extra" }))).toContainEqual(`duplicate id ${second.id}`);
    expect(copy((items) => (items[0]!.group = "nowhere" as RouteEntry["group"])).some((problem) => problem.includes("unknown group"))).toBe(true);
    expect(copy((items) => (items[0]!.binding = "done" as RouteEntry["binding"])).some((problem) => problem.includes("unknown binding"))).toBe(true);
    expect(copy((items) => items.forEach((item) => item.group === "finance" && (item.nav = "hidden")))).toContainEqual("group finance has no nav link");
    expect(copy((items) => (items[0]!.parent = "/nowhere"))).toContainEqual(`${first.id}: parent /nowhere is not a registry path`);
    expect(copy((items) => (items[0]!.sample = "/buyer")).some((problem) => problem.includes("does not resolve"))).toBe(true);
    expect(copy((items) => (items.find((item) => item.id === "handoff")!.note = undefined))).toContainEqual("handoff: evidence none without a note");
    expect(routeRegistryProblems(ROUTES, [{ path: "/x/:id", of: "/not-a-route" }]).length).toBeGreaterThan(0);
    expect(routeRegistryProblems(ROUTES, [{ path: "/buyer", of: "/discovery" }]).length).toBeGreaterThan(0);
  });

  it("keeps every URL the app answered before, and adds none silently", () => {
    const now = [...ROUTES.map((item) => item.path), ...ROUTE_ALIASES.map((alias) => alias.path)].sort();
    expect(now).toEqual([...LEGACY_PATTERNS].sort());
  });

  it("puts every route in exactly one group, and every group in the nav in registry order", () => {
    const groups = navGroups(ROUTES);
    expect(groups.map((group) => group.id)).toEqual(ROUTE_GROUPS.map((group) => group.id));
    const linked = groups.flatMap((group) => group.links.map((link) => link.path));
    expect(new Set(linked).size).toBe(linked.length);
    expect(linked.sort()).toEqual(ROUTES.filter((item) => item.nav === "link").map((item) => item.path).sort());
    expect(ROUTES.filter((item) => item.nav !== "link").every((item) => item.nav === "hidden" || item.parent !== null)).toBe(true);
  });

  it("matches the workspace registry on binding words, the primary surface and its route", () => {
    expect([...ROUTE_BINDINGS]).toEqual([...SURFACE_BINDINGS]);
    for (const item of ROUTES) {
      const surface = item.surface === null ? null : WORKSPACE_SURFACES.find((entry) => entry.id === item.surface);
      if (item.surface !== null) {
        expect(surface, `${item.id}: surface ${item.surface}`).toBeDefined();
        expect(surface?.route, item.id).toBe(item.path);
        expect(surface?.binding, item.id).toBe(item.binding);
      }
      const hasRow = WORKSPACE_SURFACES.some((entry) => entry.route === item.path);
      expect(item.evidence === "surface-row", `${item.id}: evidence flag against the surface rows`).toBe(hasRow);
    }
    const labels = MARKETING_SURFACES.map((stub) => ROUTES.find((item) => item.path === stub.path)?.label);
    expect(labels).toEqual(MARKETING_SURFACES.map((stub) => `Marketing ${stub.id}`));
  });
});

describe("App.tsx and Shell.tsx derive from the registry", () => {
  it("write no route path and no link list of their own", () => {
    const app = read("apps/web/src/App.tsx");
    const literal = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]);
    expect(literal).toEqual(["*"]);
    expect(app).toMatch(/ROUTES\.map/);
    const shell = read("apps/web/src/components/Shell.tsx");
    expect(shell).not.toMatch(/\bto: "\//);
    expect(shell).not.toMatch(/export const links/);
  });

  it("draws a real screen at every registry sample and every alias, and not-found at a path the registry lacks", () => {
    for (const item of ROUTES) {
      const html = page(item.sample);
      expect(html, item.sample).not.toContain("Page not found");
      expect(html, item.sample).toContain("<main");
    }
    for (const alias of ROUTE_ALIASES) {
      expect(page(alias.sample), alias.sample).not.toContain("Page not found");
    }
    expect(page("/no-such-screen")).toContain("Page not found");
    const withoutGift = ROUTES.filter((item) => item.path !== "/gift");
    expect(routeFor("/gift", withoutGift)).toBeNull();
  });
});

describe("registry against the matrices and the evidence doc", () => {
  const evidenceRoutes = () => {
    const section = read("docs/c-local-evidence-matrix-stub-apps-bind.md").split("\n## Surface matrix")[1]?.split("\n## ")[0] ?? "";
    return section
      .split("\n")
      .filter((line) => line.startsWith("|"))
      .map((line) => line.split("|")[2]?.trim() ?? "")
      .filter((cell) => cell.startsWith("/"));
  };
  const facing = () => ({ a11y: A11Y_SCREENS, e2e: E2E_ROUTE as Record<string, string>, evidenceRoutes: evidenceRoutes() });

  it("agree with the a11y screen matrix, the browser journeys and the evidence doc, both ways", () => {
    expect(evidenceRoutes().length).toBeGreaterThan(0);
    expect(matrixDriftProblems(ROUTES, facing())).toEqual([]);
  });

  it("fails when a matrix, the journeys or the evidence doc drifts from the registry", () => {
    const base = facing();
    expect(matrixDriftProblems(ROUTES, { ...base, a11y: base.a11y.slice(1) }).length).toBeGreaterThan(0);
    expect(matrixDriftProblems(ROUTES, { ...base, a11y: [...base.a11y, { screenId: "ghost", pattern: "/ghost", label: "Ghost" }] })).toContainEqual("a11y screen ghost is not in the registry");
    expect(matrixDriftProblems(ROUTES, { ...base, a11y: base.a11y.map((screen) => (screen.screenId === "gift" ? { ...screen, label: "Present" } : screen)) }).length).toBeGreaterThan(0);
    expect(matrixDriftProblems(ROUTES, { ...base, e2e: { ...base.e2e, ghost: "/ghost" } })).toContainEqual("e2e journey ghost is not in the registry");
    expect(matrixDriftProblems(ROUTES, { ...base, e2e: { ...base.e2e, gift: "/resale" } }).length).toBeGreaterThan(0);
    expect(matrixDriftProblems(ROUTES, { ...base, evidenceRoutes: base.evidenceRoutes.filter((route) => route !== "/gift") })).toContainEqual("evidence doc has no surface row for /gift");
    expect(matrixDriftProblems(ROUTES, { ...base, evidenceRoutes: [...base.evidenceRoutes, "/ghost"] }).length).toBeGreaterThan(0);
    expect(matrixDriftProblems(ROUTES.filter((item) => item.path !== "/gift"), base).length).toBeGreaterThan(0);
  });

  it("the a11y doc has a user acceptance row for every registry a11y screen", () => {
    const table = read("docs/c-a11y-acceptance-stub-apps-bind.md").split("## User acceptance matrix")[1]?.split("\n## ")[0] ?? "";
    for (const item of ROUTES.filter((entry) => entry.a11y !== null)) {
      expect(table, item.a11y ?? "").toContain(`\`${item.a11y}\``);
    }
  });

  it("the bind doc route table is the registry, row for row", () => {
    const doc = read("docs/c-route-registry-navigation-stub-apps-bind.md");
    const table = doc.split("## Route table")[1]?.split("\n## ")[0] ?? "";
    const rows = table.split("\n").filter((line) => line.startsWith("| `"));
    expect(rows).toEqual(registryRows());
  });
});

describe("grouped nav, current page, breadcrumb and landmarks (server markup)", () => {
  it("marks at most one link current, and the right one, on every route", () => {
    for (const item of ROUTES) {
      const nav = surfacesNav(page(item.sample));
      expect(nav, item.sample).not.toBe("");
      const expected = currentNavPath(item.sample);
      expect(countOf(nav, 'aria-current="page"'), item.sample).toBe(expected === null ? 0 : 1);
      if (expected !== null) {
        expect(nav).toMatch(new RegExp(`<a[^>]*aria-current="page"[^>]*href="${expected}"|<a[^>]*href="${expected}"[^>]*aria-current="page"`));
      }
    }
    expect(currentNavPath("/gift/x")).toBeNull();
    expect(currentNavPath("/booking/evt_x")).toBeNull();
    expect(currentNavPath("/discovery/row_1")).toBe("/discovery");
    expect(currentNavPath("/marketing/m03")).toBe("/marketing");
    expect(currentNavPath("/marketing/journey")).toBe("/marketing/journey");
    expect(countOf(surfacesNav(page("/gift/x")), 'aria-current="page"')).toBe(0);
  });

  it("lists every nav link once, inside its own labelled group, with the label as the whole link text", () => {
    const nav = surfacesNav(page("/"));
    expect(nav).toContain('aria-expanded="false"');
    expect(nav).toContain('aria-controls="surface-menu"');
    expect(nav).toContain('id="surface-menu"');
    expect(nav.slice(1)).not.toContain("<nav");
    for (const group of navGroups(APP_ROUTES)) {
      const start = nav.indexOf(`id="nav-group-${group.id}"`);
      expect(start, group.id).toBeGreaterThan(-1);
      expect(nav).toContain(`aria-labelledby="nav-group-${group.id}"`);
      let at = start;
      for (const link of group.links) {
        const found = nav.indexOf(`href="${link.path}"`, at);
        expect(found, `${group.id} ${link.path}`).toBeGreaterThan(at);
        expect(nav.slice(found, found + 400)).toContain(`>${link.label}</a>`);
        at = found;
      }
    }
    expect(countOf(nav, "<a ")).toBe(APP_ROUTES.filter((item) => item.nav === "link").length);
  });

  it("draws the breadcrumb with the page as the current crumb, the group as text, and the binding word", () => {
    const m01 = page("/marketing/m01");
    const crumbs = crumbNav(m01);
    expect(crumbs).toMatch(/<a href="\/marketing"[^>]*>Marketing<\/a>/);
    expect(crumbs).toContain('<span aria-current="page">Marketing M01</span>');
    expect(m01).toContain("<strong>no-published-command</strong>");
    const credit = crumbNav(page("/credit/servicing"));
    // The group name repeats the parent link, so only the link is drawn.
    expect(credit).not.toContain("<span>Credit</span>");
    expect(crumbNav(page("/discovery"))).toContain("<span>Buyer</span>");
    expect(credit).toMatch(/<a href="\/credit"[^>]*>Credit<\/a>/);
    expect(crumbNav(page("/booking/evt_lanterns"))).not.toContain("<a ");
    expect(crumbNav(page("/buyer"))).toBe(
      '<nav aria-label="Breadcrumb"><ol class="crumbs"><li><span aria-current="page">Buyer</span></li></ol><p class="crumb-binding">Binding <strong>stub-only</strong></p></nav>',
    );
    expect(crumbNav(page("/no-such-screen"))).toBe("");
    expect(page("/no-such-screen")).not.toContain("crumb-binding");
    expect(breadcrumbFor("/discovery/row_1").map((crumb) => crumb.label)).toEqual(["Buyer", "Discover"]);
    for (const item of ROUTES) {
      expect(page(item.sample), item.sample).not.toMatch(/<nav aria-label="Breadcrumb">(?:(?!<\/nav>).)*href="\/booking/s);
      expect(countOf(crumbNav(page(item.sample)), 'aria-current="page"'), item.sample).toBe(1);
    }
    const alone = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/nowhere"]}>
        <Breadcrumb />
      </MemoryRouter>,
    );
    expect(alone).toBe("");
  });

  it("has one banner, one main, a skip link first, and distinct names for every navigation landmark", () => {
    for (const sample of ["/", "/credit/origination", "/marketing/m05", "/no-such-screen"]) {
      const html = page(sample);
      // Panels use <header> inside sections, which is not a banner; the shell's own is the one with class "top".
      expect(countOf(html, '<header class="top">'), sample).toBe(1);
      expect(countOf(html, "<main"), sample).toBe(1);
      expect(html.indexOf('class="skip" href="#desk-main"'), sample).toBeLessThan(html.indexOf('<header class="top">'));
      expect(html).toContain('<main id="desk-main" tabindex="-1">');
      const names = [...html.matchAll(/<nav aria-label="([^"]+)"/g)].map((match) => match[1]!);
      expect(new Set(names).size, `${sample}: ${names.join(", ")}`).toBe(names.length);
      expect(names).toContain("Surfaces");
    }
  });

  it("keeps the not-found list inside the registry paths", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]!);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(ROUTES.some((item) => item.path === href), href).toBe(true);
    }
  });

  it("claims nothing: no price, no money word and no integration claim in the nav or breadcrumb", () => {
    for (const item of ROUTES) {
      const html = page(item.sample);
      const chrome = surfacesNav(html) + crumbNav(html);
      expect(chrome).not.toMatch(/[$₩]|KRW|USD|still open|in stock|capture|설계중|미착수|integrated|qualified|accepted|released/i);
    }
  });
});

describe("source", () => {
  it("the new navigation files avoid the banned words and import no desk, adapter or storage module", () => {
    const files = ["src/shell/route-registry.ts", "src/components/SurfaceNav.tsx", "src/components/Breadcrumb.tsx"];
    for (const file of files) {
      const source = readFileSync(path.join(web, file), "utf8");
      for (const word of ["fetch(", "invokeLocalCall", "capture", "settle_capture", "fallback", "placeHold", "Date.now(", "Math.random(", "127.0.0.1", "/health", "retry", "localStorage", "sessionStorage", "@kix/protocol-adapter"]) {
        expect(source.includes(word), `${file} contains ${word}`).toBe(false);
      }
      for (const spec of [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]!)) {
        expect(["react", "react-router-dom", "../marketing/labels", "../i18n/locale-context", "../i18n/use-page-identity"].includes(spec) || spec.startsWith("./") || spec.startsWith("../shell/"), `${file} imports ${spec}`).toBe(true);
      }
    }
    expect(readdirSync(path.join(web, "src/shell")).includes("route-registry.ts")).toBe(true);
  });
});
