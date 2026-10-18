import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { links } from "../src/components/Shell";
import { NotFoundPage } from "../src/pages/NotFound";
import { identifyPage } from "../src/shell/page-identity";
import { AppBoundary, ErrorPanel, RenderBoundary, stateAfterReset } from "../src/shell/RenderBoundary";
import { classifyFault } from "../src/shell/render-fault";
import { CarryingError, HOSTILE_TEXT, THROWN_SAMPLES, ThrowingScreen } from "./support/render-fault-fixtures";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "..");
const read = (file: string) => readFileSync(path.join(web, file), "utf8");

function panelFor(thrown: unknown, scope: "route" | "app" = "route"): string {
  const fault = classifyFault(thrown);
  return renderToStaticMarkup(
    <MemoryRouter>
      <ErrorPanel fault={fault} scope={scope} screenLabel="Receipts" onAgain={() => undefined} />
    </MemoryRouter>,
  );
}

describe("render fault panel never shows a stack, a message or a body", () => {
  it("prints cause, screen, reference and both actions for every thrown shape", () => {
    for (const sample of THROWN_SAMPLES) {
      const html = panelFor(sample);
      expect(html).toContain("Render error");
      expect(html).toContain("Receipts");
      expect(html).toMatch(/shell-fault-\d{4}/);
      expect(html).toContain("Show this screen again");
      expect(html).toContain("Go to Box office");
      expect(html).toContain('role="alert"');
      for (const hostile of Object.values(HOSTILE_TEXT)) {
        expect(html).not.toContain(hostile);
      }
      expect(html).not.toMatch(/Bearer|sk_live|@example|\.tsx|Error:|tok_FAKE/);
    }
  });

  it("keeps only a safe code and safe ids, and says so when no request was involved", () => {
    const carrying = classifyFault(new CarryingError());
    expect(carrying).toMatchObject({ code: "GATE_UNAVAILABLE", requestId: "req_0123456789", correlationId: "cor_0123456789" });
    expect(panelFor(new CarryingError())).toContain("req_0123456789");
    const hostile = classifyFault({ code: "lower case", requestId: HOSTILE_TEXT.bearer });
    expect(hostile).toMatchObject({ code: null, requestId: null, correlationId: null });
    expect(panelFor("str")).toContain("none (no request was involved)");
    expect(Object.keys(carrying).sort()).toEqual(["code", "correlationId", "kind", "reference", "requestId"]);
  });

  it("gives each fault its own local reference", () => {
    expect(classifyFault(null).reference).not.toBe(classifyFault(null).reference);
  });

  it("app scope uses a plain link home, route scope a router link", () => {
    expect(panelFor("x", "app")).toContain('href="/"');
    expect(panelFor("x", "route")).toContain('data-scope="route"');
  });

  it("says it sent nothing and cleared nothing, and does not resolve UNKNOWN", () => {
    const html = panelFor("x");
    expect(html).toContain("sent nothing and cleared nothing");
    expect(html).toContain("An UNKNOWN result is not resolved by this panel");
  });
});

describe("RenderBoundary", () => {
  const props = { scope: "route" as const, resetKey: "k", screenLabel: "Receipts" };

  it("turns a thrown error into only the classified fault", () => {
    const derived = RenderBoundary.getDerivedStateFromError(new CarryingError());
    expect(JSON.stringify(derived)).not.toContain("leak");
    expect(JSON.stringify(derived)).not.toContain(HOSTILE_TEXT.bearer);
    const boundary = new RenderBoundary({ ...props, children: null });
    boundary.state = { fault: derived.fault ?? null, keyAtFault: "k" };
    const html = renderToStaticMarkup(<MemoryRouter>{boundary.render()}</MemoryRouter>);
    expect(html).toContain("This screen could not be drawn");
  });

  it("renders children when there is no fault and clears the fault on reset", () => {
    const boundary = new RenderBoundary({ ...props, children: <p>fine</p> });
    expect(renderToStaticMarkup(<>{boundary.render()}</>)).toContain("fine");
    expect(stateAfterReset()).toEqual({ fault: null, keyAtFault: null });
  });

  it("does not render the failing child on the server path, and the fixture throws on purpose", () => {
    expect(() => renderToStaticMarkup(<ThrowingScreen />)).toThrow();
  });

  it("the shell files import no adapter, desk, protocol or storage module, so a fault cannot resend or clear anything", () => {
    for (const file of readdirSync(path.join(web, "src/shell"))) {
      const source = read(`src/shell/${file}`);
      const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]!);
      for (const spec of imports) {
        expect(["react", "react-router-dom"].includes(spec) || spec.startsWith("./") || spec === "../marketing/labels", `${file} imports ${spec}`).toBe(true);
      }
    }
  });

  it("source of the shell, boundary and not-found files avoids the banned words", () => {
    const files = [...readdirSync(path.join(web, "src/shell")).map((file) => `src/shell/${file}`), "src/pages/NotFound.tsx"];
    for (const file of files) {
      const source = read(file);
      for (const word of ["fetch(", "invokeLocalCall", "capture", "settle_capture", "fallback", "placeHold", "Date.now(", "Math.random(", "127.0.0.1", "/health", "retry", "localStorage", "sessionStorage"]) {
        expect(source.includes(word), `${file} contains ${word}`).toBe(false);
      }
    }
  });
});

describe("not found and page identity", () => {
  it("draws a not-found screen at an unknown path instead of redirecting", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/no-such-screen"]}>
        <App />
      </MemoryRouter>,
    );
    expect(html).toContain("<h2");
    expect(html).toContain("Page not found");
    expect(html).toContain("Go to Box office");
    expect(html).not.toContain("no-such-screen");
    expect(html).not.toContain("North Station Lanterns");
  });

  it("links home and the main screens", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    for (const href of ["/", "/buyer", "/discovery", "/receipts", "/handoff", "/journeys"]) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("every App.tsx route pattern is identified, and the catch-all is the one unknown path", () => {
    const patterns = [...read("src/App.tsx").matchAll(/<Route path="([^"]+)"/g)].map((match) => match[1]!);
    expect(patterns.length).toBeGreaterThan(30);
    for (const pattern of patterns) {
      const concrete = pattern.replace(":eventId", "evt_x").replace(":rowId", "row_x");
      const identity = identifyPage(concrete, links);
      expect(identity.known, pattern).toBe(pattern !== "*");
    }
    expect(identifyPage("/definitely/not/here", links)).toMatchObject({ known: false, key: "*" });
  });

  it("titles are per page, the discovery alias shares one key, and marketing keeps its own title", () => {
    expect(identifyPage("/", links).title).toBe("KIX Box Office");
    expect(identifyPage("/receipts", links).title).toBe("Receipts · KIX Box Office");
    expect(identifyPage("/booking/evt_lanterns", links).title).toBe("Booking · KIX Box Office");
    expect(identifyPage("/discovery/row_1", links).key).toBe(identifyPage("/discovery", links).key);
    expect(identifyPage("/marketing/m01", links).title).toMatch(/^KIX Marketing · M01/);
    expect(identifyPage("/marketing/zzz", links).title).toBe("Page not found · KIX Box Office");
    expect(identifyPage("/nope", links).title).toBe("Page not found · KIX Box Office");
    const titles = links.map((link) => identifyPage(link.to, links).title);
    expect(titles.every((title) => title.length > 0 && !title.startsWith("Page not found"))).toBe(true);
  });

  it("app boundary renders its children untouched when nothing throws", () => {
    const html = renderToStaticMarkup(
      <AppBoundary>
        <p>shell child</p>
      </AppBoundary>,
    );
    expect(html).toBe("<p>shell child</p>");
  });
});

describe("index.html boot and noscript notes", () => {
  const html = read("index.html");
  it("has a noscript note and a loading note with no external resource, link, inline style or extra script", () => {
    expect(html).toMatch(/<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/);
    expect(html).toContain('id="root"');
    expect(html).toMatch(/Loading the desk/);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/\sstyle=/);
    expect([...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0])).toEqual(['<script type="module" src="/src/main.tsx">']);
  });
});
