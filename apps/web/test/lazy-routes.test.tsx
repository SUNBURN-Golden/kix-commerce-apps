import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { screens } from "../src/screens";
import { ROUTES, ROUTE_ALIASES } from "../src/shell/route-registry";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "..");
const read = (file: string) => readFileSync(path.join(web, file), "utf8");

describe("every registry route loads its screen on demand", () => {
  const source = read("src/screens.ts");
  const keys = [...source.matchAll(/^ {2}"?([\w-]+)"?: \(\) => import\("(\.\/pages\/[^"]+)"\)/gm)];

  it("has one dynamic import per registry route and no other entry", () => {
    expect(keys.map((match) => match[1]).sort()).toEqual(ROUTES.map((route) => route.id).sort());
    expect(new Set(keys.map((match) => match[1])).size).toBe(ROUTES.length);
  });

  it("points every import at a real page file", () => {
    for (const match of keys) {
      const target = path.join(web, "src", `${match[2]}.tsx`);
      expect(existsSync(target), `${match[1]} -> ${match[2]}`).toBe(true);
    }
  });

  it("imports no screen statically: App.tsx keeps only the not-found page, screens.ts keeps none", () => {
    const statics = (text: string) => [...text.matchAll(/^import\b[^;]*from "(\.\/pages\/[^"]+)";/gm)].map((match) => match[1]);
    expect(statics(read("src/App.tsx"))).toEqual(["./pages/NotFound"]);
    expect(statics(source)).toEqual([]);
  });

  it("App.tsx suspends each route with the loading note keyed by the registry id", () => {
    const app = read("src/App.tsx");
    expect(app).toContain("<Suspense key={entry.id}");
    expect(app).toContain("<ScreenLoading label={entry.label}");
    expect(app).toMatch(/ROUTES\.map/);
    expect(app).toMatch(/ROUTE_ALIASES\.map/);
  });

  it("has every route's code loaded after the test preload, so a synchronous render draws the screen", () => {
    for (const route of ROUTES) {
      expect(screens.state(route.id), route.id).toBe("ready");
    }
  });

  it("draws the screen, not the loading note, at every sample and alias once loaded", () => {
    const samples = [...ROUTES.map((route) => route.sample), ...ROUTE_ALIASES.map((alias) => alias.sample)];
    for (const sample of samples) {
      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={[sample]}>
          <App />
        </MemoryRouter>,
      );
      expect(html, sample).not.toContain("data-screen-loading");
      expect(html, sample).toMatch(/<main[^>]*>(?!<p class="screen-loading")/);
    }
  });
});
