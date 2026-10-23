/**
 * Pure checks over a route registry. They take the registry as an argument so a test can hand them a mutated copy
 * and expect a problem. App-internal; not a public schema.
 */
import { matchPath } from "react-router-dom";
import { ROUTES, ROUTE_BINDINGS, ROUTE_GROUPS, routeFor, type RouteEntry } from "../../src/shell/route-registry";

type Aliases = readonly { path: string; of: string; sample?: string }[];

function duplicates(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

/** Problems inside the registry itself: repeats, an unknown group or binding, a dangling parent, a sample that does not resolve back. */
export function routeRegistryProblems(routes: readonly RouteEntry[], aliases: Aliases): string[] {
  const problems: string[] = [];
  for (const key of ["id", "path", "label"] as const) {
    for (const value of new Set(duplicates(routes.map((item) => item[key])))) {
      problems.push(`duplicate ${key} ${value}`);
    }
  }
  const groups: readonly string[] = ROUTE_GROUPS.map((group) => group.id);
  const bindings: readonly string[] = ROUTE_BINDINGS;
  for (const item of routes) {
    if (!groups.includes(item.group)) {
      problems.push(`${item.id}: unknown group ${item.group}`);
    }
    if (!bindings.includes(item.binding)) {
      problems.push(`${item.id}: unknown binding ${item.binding}`);
    }
    if (item.parent !== null && !routes.some((other) => other.path === item.parent)) {
      problems.push(`${item.id}: parent ${item.parent} is not a registry path`);
    }
    if (item.nav === "section" && item.parent === null) {
      problems.push(`${item.id}: a section route needs a parent`);
    }
    if (!matchPath({ path: item.path, end: true }, item.sample) || routeFor(item.sample, routes, aliases)?.path !== item.path) {
      problems.push(`${item.id}: sample ${item.sample} does not resolve to ${item.path}`);
    }
    if (item.evidence === "none" && !item.note) {
      problems.push(`${item.id}: evidence none without a note`);
    }
    if (item.label.trim() === "") {
      problems.push(`${item.id}: empty label`);
    }
  }
  for (const group of ROUTE_GROUPS) {
    if (!routes.some((item) => item.group === group.id && item.nav === "link")) {
      problems.push(`group ${group.id} has no nav link`);
    }
  }
  for (const alias of aliases) {
    if (!routes.some((item) => item.path === alias.of)) {
      problems.push(`alias ${alias.path} points at ${alias.of}, which is not a registry path`);
    }
    if (routes.some((item) => item.path === alias.path)) {
      problems.push(`alias ${alias.path} repeats a registry path`);
    }
  }
  return problems;
}

export interface Facing {
  a11y: readonly { screenId: string; pattern: string; label: string }[];
  /** Browser journeys suite id -> the route pattern it drives. */
  e2e: Readonly<Record<string, string>>;
  /** The Route column of the evidence doc's surface table. */
  evidenceRoutes: readonly string[];
}

/** Problems between the registry and the three places that list routes again, in both directions. No counts. */
export function matrixDriftProblems(routes: readonly RouteEntry[], other: Facing): string[] {
  const problems: string[] = [];
  const a11yRoutes = routes.filter((item) => item.a11y !== null);
  for (const item of a11yRoutes) {
    const screen = other.a11y.find((entry) => entry.screenId === item.a11y);
    if (!screen) {
      problems.push(`a11y matrix has no screen ${item.a11y} for ${item.path}`);
    } else if (screen.pattern !== item.path || screen.label !== item.label) {
      problems.push(`a11y screen ${screen.screenId} says ${screen.pattern} "${screen.label}", registry says ${item.path} "${item.label}"`);
    }
  }
  for (const screen of other.a11y) {
    if (!a11yRoutes.some((item) => item.a11y === screen.screenId)) {
      problems.push(`a11y screen ${screen.screenId} is not in the registry`);
    }
  }
  for (const [journey, pattern] of Object.entries(other.e2e)) {
    const item = routes.find((entry) => entry.e2e === journey);
    if (!item) {
      problems.push(`e2e journey ${journey} is not in the registry`);
    } else if (item.path !== pattern) {
      problems.push(`e2e journey ${journey} drives ${pattern}, registry says ${item.path}`);
    }
  }
  for (const item of routes) {
    if (item.e2e !== null && !(item.e2e in other.e2e)) {
      problems.push(`registry names e2e journey ${item.e2e} for ${item.path}, which the suite does not have`);
    }
  }
  const expected = new Set(routes.filter((item) => item.evidence === "surface-row").map((item) => item.path));
  const seen = new Set(other.evidenceRoutes);
  for (const path of expected) {
    if (!seen.has(path)) {
      problems.push(`evidence doc has no surface row for ${path}`);
    }
  }
  for (const path of seen) {
    if (!expected.has(path)) {
      problems.push(`evidence doc lists ${path}, which the registry does not mark as having a surface row`);
    }
  }
  return problems;
}

/** The rows the bind doc's route table must carry. Generated from the registry, so the doc cannot drift from it. */
export function registryRows(routes: readonly RouteEntry[] = ROUTES): string[] {
  return routes.map((item) => {
    const group = ROUTE_GROUPS.find((entry) => entry.id === item.group)?.label ?? item.group;
    return `| \`${item.path}\` | ${item.label} | ${group} | ${item.binding} | ${item.nav} | ${item.a11y ?? "-"} | ${item.e2e ?? "-"} | ${item.evidence} |`;
  });
}

/** A surface row must name its browser journey or explain the gap. */
export function surfaceRowE2eProblems(routes: readonly RouteEntry[]): string[] {
  return routes.filter((route) => route.evidence === "surface-row" && route.e2e === null && !route.note?.trim())
    .map((route) => route.id + ": surface-row without e2e or note");
}
