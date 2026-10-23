import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { SESSION_RETENTION_POLICY } from "@kix/protocol-adapter";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { Shell } from "../src/components/Shell";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { makeTranslate } from "../src/i18n/translate";
import { clearOnboardingDismissed, ONBOARDING_DISMISSED, ONBOARDING_STORAGE_KEY, readOnboardingDismissed, writeOnboardingDismissed } from "../src/onboarding/onboarding-store";
import { ROLE_STARTS } from "../src/onboarding/roles";
import { ErrorPanel } from "../src/shell/RenderBoundary";
import { ROUTE_ALIASES, ROUTES } from "../src/shell/route-registry";
import { isAllowedStorageKey, scanStorageViolations } from "../src/storage-allow-list";
import { WORKSPACE_SURFACES } from "../src/workspace/registry";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
afterEach(() => {
  if (original) Object.defineProperty(globalThis, "sessionStorage", original);
  else delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
});
const draw = (at: string, locale: "ko" | "en", element = <App />) => renderToStaticMarkup(
  <LocaleProvider initial={locale}><MemoryRouter initialEntries={[at]}>{element}</MemoryRouter></LocaleProvider>,
);
function memoryStore() {
  const values = new Map<string, string>();
  const store = {
    get length() { return values.size; },
    key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  Object.defineProperty(globalThis, "sessionStorage", { value: store, configurable: true });
  return store;
}

const samples = [...ROUTES.map((entry) => entry.sample), ...ROUTE_ALIASES.map((entry) => entry.path.replace(":rowId", "fixture")), "/no-such-screen"];

describe("first-run guide and demo mark", () => {
  it("shows the non-modal guide and demo mark on every registry sample, alias and not-found, in both languages", () => {
    memoryStore();
    for (const locale of ["en", "ko"] as const) {
      for (const at of samples) {
        const html = draw(at, locale);
        expect(html, at).toContain('data-first-run="shown"');
        expect(html).toContain('aria-labelledby="first-run-title"');
        expect(html).toContain(makeTranslate(locale)("onboarding.skip"));
        expect(html).toContain(makeTranslate(locale)("demo.mark"));
        expect(html).toContain('data-demo="synthetic"');
        expect(html).toContain('href="/help"');
        expect(html).toContain("docs/guide/local-run-ko.md");
        expect(html).not.toMatch(/<dialog|aria-modal|autofocus/i);
      }
    }
  });

  it("reads the dismissal through App and keeps the demo mark and show-again control on every screen", () => {
    memoryStore();
    writeOnboardingDismissed();
    for (const locale of ["en", "ko"] as const) {
      for (const at of samples) {
        const html = draw(at, locale);
        expect(html).not.toContain('data-first-run="shown"');
        expect(html).toContain('id="first-run-show"');
        expect(html).toContain(makeTranslate(locale)("onboarding.showAgain"));
        expect(html).toContain('data-demo="synthetic"');
      }
    }
  });

  it("derives the three role starts from matching workspace surfaces and registry routes", () => {
    expect(ROLE_STARTS.map((entry) => entry.role)).toEqual(["buyer", "organizer", "operator"]);
    for (const { role, path } of ROLE_STARTS) {
      expect(ROUTES.some((entry) => entry.path === path)).toBe(true);
      const surfaceIds = { buyer: "buyer-workspace", organizer: "organizer-workspace", operator: "receipt-explorer" };
      expect(WORKSPACE_SURFACES.find((entry) => entry.id === surfaceIds[role])).toMatchObject({ route: path, role });
      const link = draw("/", "en").match(new RegExp(`<a[^>]*data-role="${role}"[^>]*>`))?.[0];
      expect(link).toContain(`href="${path}"`);
    }
  });

  it("marks both kinds of app error; route errors keep the shell mark", () => {
    for (const locale of ["en", "ko"] as const) {
      for (const kind of ["screen-load-error", "render-error"] as const) {
        const fault = { kind, reference: "shell-fault-0001", requestId: null, correlationId: null, code: null };
        const app = <ErrorPanel fault={fault} scope="app" screenLabel="x" onAgain={() => {}} />;
        const route = <Shell><ErrorPanel fault={fault} scope="route" screenLabel="x" onAgain={() => {}} /></Shell>;
        for (const element of [app, route]) {
          const html = draw("/", locale, element);
          expect(html.match(/data-demo="synthetic"/g)).toHaveLength(1);
          expect(html).toContain(makeTranslate(locale)("demo.mark"));
        }
      }
    }
  });
});

describe("onboarding preference storage", () => {
  it("writes only an allow-listed literal and clearing shows the guide again", () => {
    const store = memoryStore();
    expect(readOnboardingDismissed()).toBe(false);
    store.setItem(ONBOARDING_STORAGE_KEY, "true");
    expect(readOnboardingDismissed()).toBe(false);
    writeOnboardingDismissed();
    expect(ONBOARDING_STORAGE_KEY).toBe("kix-onboarding");
    expect(ONBOARDING_DISMISSED).toBe("dismissed");
    expect(store.getItem(ONBOARDING_STORAGE_KEY)).toBe("dismissed");
    expect(readOnboardingDismissed()).toBe(true);
    expect(isAllowedStorageKey(ONBOARDING_STORAGE_KEY)).toBe(true);
    expect(isAllowedStorageKey("kix-onboarding-x")).toBe(false);
    expect(scanStorageViolations(store)).toEqual([]);
    clearOnboardingDismissed();
    expect(readOnboardingDismissed()).toBe(false);
    expect(store.length).toBe(0);
    expect(draw("/", "en")).toContain('data-first-run="shown"');
  });

  it("tolerates missing storage, a throwing getter and refused reads/writes/removals", () => {
    for (const descriptor of [
      { value: undefined },
      { get() { throw new Error("blocked"); } },
      { value: { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); }, removeItem() { throw new Error("blocked"); } } },
    ]) {
      Object.defineProperty(globalThis, "sessionStorage", { ...descriptor, configurable: true });
      expect(readOnboardingDismissed()).toBe(false);
      expect(writeOnboardingDismissed).not.toThrow();
      expect(clearOnboardingDismissed).not.toThrow();
      expect(draw("/", "en")).toContain('data-first-run="shown"');
    }
  });
});

it("adds no clock, retention value, transport or live region to onboarding", () => {
  const dir = "apps/web/src/onboarding";
  for (const file of readdirSync(path.join(root, dir))) {
    const source = read(`${dir}/${file}`);
    for (const banned of ["Date.now(", "setTimeout", "fetch(", "invokeLocalCall", "capture", "settle_capture", "fallback", "placeHold", "Math.random(", "127.0.0.1", "/health", "retry", "localStorage", "autoFocus", "aria-live", "data-status", 'role="status"', "style={"]) {
      expect(source, `${file}: ${banned}`).not.toContain(banned);
    }
    expect(source).not.toMatch(/\bttl\b|\bexpires?\b|\bmaxAge\b/i);
    expect(source.includes("sessionStorage")).toBe(file === "onboarding-store.ts");
  }
  expect(SESSION_RETENTION_POLICY).toBe("UNDETERMINED");
});

it("documents the guide, undetermined retention, ruling and unchanged screen scope", () => {
  const bindPath = "docs/c-first-run-onboarding-stub-apps-bind.md";
  const bind = read(bindPath);
  const readme = read("README.md");
  const ruling = "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";
  expect(readme).toContain(bindPath);
  expect(readme).toContain(ruling);
  expect(bind).toContain(ruling);
  expect(bind).toContain("contract_change=NO");
  for (const doc of [bind, read("docs/guide/local-run-ko.md")]) {
    expect(doc).toContain("UNDETERMINED");
    expect(doc).toContain("kix-onboarding");
  }
  expect(bind).toMatch(/no route or screen change/i);
});
