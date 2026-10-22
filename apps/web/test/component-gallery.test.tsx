import { readFileSync, readdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ScreenLoading } from "../src/components/ScreenLoading";
import { App } from "../src/App";
import { protocol } from "../src/protocol";
import { ComponentGallery } from "../src/dev/gallery/ComponentGallery";
import { GALLERY_CASES, galleryCaseProblems } from "../src/dev/gallery/cases";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { APP_ROUTES, ROUTES, routeFor } from "../src/shell/route-registry";
import { DEV_SCREENS, GALLERY_CASE_IDS, GALLERY_CHECK_IDS } from "../../e2e/src/gallery-matrix";

const render = (child: React.ReactNode, path: string, locale: "en" | "ko") => renderToStaticMarkup(
  <LocaleProvider initial={locale}><MemoryRouter initialEntries={[path]}>{child}</MemoryRouter></LocaleProvider>,
);

describe("development component gallery", () => {
  it("covers every shared component export and rejects inventory gaps and duplicate IDs", () => {
    expect(galleryCaseProblems(GALLERY_CASES)).toEqual([]);
    expect(GALLERY_CASES.map((entry) => entry.id)).toEqual(GALLERY_CASE_IDS);
    for (const name of readdirSync(new URL("../src/components/", import.meta.url))) {
      const source = readFileSync(new URL(`../src/components/${name}`, import.meta.url), "utf8");
      for (const match of source.matchAll(/export function (\w+)/g)) expect(GALLERY_CASES.some((entry) => entry.component === match[1]), match[1]).toBe(true);
    }
    expect(galleryCaseProblems(GALLERY_CASES.slice(1))).toContain("missing component Shell");
    expect(galleryCaseProblems([...GALLERY_CASES, GALLERY_CASES[0]!])).toContain("duplicate case shell-stub");
  });

  it("owns exactly one Shell and main for the gallery and its trailing-slash URL", () => {
    for (const path of ["/dev/gallery", "/dev/gallery/"]) {
      const html = render(<App />, path, "en");
      expect((html.match(/<main/g) ?? []).length, path).toBe(1);
      expect((html.match(/class="shell"/g) ?? []).length, path).toBe(1);
    }
  });

  it("refuses the selected HTTP adapter before drawing a Shell or preview; never selects stub", () => {
    const meta = protocol.describe();
    const describeAdapter = vi.spyOn(protocol, "describe").mockReturnValue({ ...meta, environment: "integration-http" });
    try {
      for (const path of ["/dev/gallery", "/dev/gallery?specimen=shell-stub"]) {
        const html = render(<ComponentGallery />, path, "en");
        expect(html).toContain("HTTP selection is refused");
        expect(html).not.toContain('class="shell"');
        expect(html).not.toContain("<iframe");
      }
    } finally {
      describeAdapter.mockRestore();
    }
    expect(protocol.describe()).toEqual(meta);
  });

  for (const locale of ["en", "ko"] as const) {
    for (const entry of GALLERY_CASES) {
      it(`${entry.id} / ${locale} DOM snapshot`, () => {
        const html = render(entry.render(), entry.samplePath, locale);
        expect(html).toMatchSnapshot();
        expect(html).not.toContain("[object Object]");
      });
    }
    it(`lists and isolates every specimen / ${locale}`, () => {
      const html = render(<ComponentGallery />, "/dev/gallery", locale);
      expect((html.match(/data-gallery-case=/g) ?? []).length).toBe(GALLERY_CASES.length);
      for (const entry of GALLERY_CASES) {
        expect(html).toContain(`specimen=${entry.id}&amp;lang=${locale}`);
        const preview = render(<ComponentGallery />, `/dev/gallery?specimen=${entry.id}`, locale);
        expect((preview.match(/<main/g) ?? []).length).toBe(1);
      }
      expect(render(<ComponentGallery />, "/dev/gallery?specimen=missing", locale)).toContain('role="status"');
      expect(render(<ComponentGallery />, "/dev/gallery?specimen=", locale)).toContain('role="status"');
    });
  }

  it("combines async loading semantics with development labels and unknown caller labels", () => {
    for (const locale of ["en", "ko"] as const) {
      const loading = render(<ScreenLoading label="Component gallery" />, "/dev/gallery", locale);
      expect(loading).toContain('data-async-state="loading"');
      expect(loading).toContain('aria-busy="true"');
      expect(loading).toContain(locale === "ko" ? "컴포넌트 갤러리" : "Component gallery");
      expect(render(<ScreenLoading label="Synthetic caller" />, "/unmatched", locale)).toContain("Synthetic caller");
    }
  });

  it("keeps production routes separate, and tracks development coverage in both matrices and docs", () => {
    expect(ROUTES.some((entry) => entry.path === "/dev/gallery")).toBe(false);
    const extensions = APP_ROUTES.filter((entry) => !ROUTES.some((production) => production.id === entry.id));
    expect(extensions.map((entry) => ({ screenId: entry.a11y, path: entry.path, label: entry.label }))).toEqual(DEV_SCREENS);
    expect(routeFor("/dev/gallery")?.binding).toBe("stub-only");
    const doc = readFileSync(new URL("../../../docs/c-local-evidence-matrix-stub-apps-bind.md", import.meta.url), "utf8").split("## Development-only route coverage")[1]?.split("\n## ")[0] ?? "";
    expect(doc).toContain("| /dev/gallery | development stub only |");
    for (const id of GALLERY_CHECK_IDS) expect(doc).toContain(id);
    for (const facet of ["UNQUALIFIED", "PENDING", "NOT_AUTHORIZED"]) expect(doc).toContain(facet);
  });
});
