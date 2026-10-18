import { Suspense, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ScreenLoading } from "../src/components/ScreenLoading";
import { ErrorPanel, RenderBoundary } from "../src/shell/RenderBoundary";
import { classifyFault } from "../src/shell/render-fault";
import { ScreenSlot } from "../src/shell/ScreenSlot";
import { ScreenLoadError, createScreenLoader, forgetFailedScreens, type ScreenImport } from "../src/shell/screen-loader";
import { CarryingError, HOSTILE_TEXT } from "./support/render-fault-fixtures";

const Hello: ComponentType = () => <p>hello screen</p>;
const STALE_URL = "https://cdn.example.test/assets/Gift-AbC12345.js?token=tok_FAKE_body_secret";

function counting(outcome: () => Promise<{ default: ComponentType }>) {
  let calls = 0;
  const load: ScreenImport = () => {
    calls += 1;
    return outcome();
  };
  return { load, calls: () => calls };
}

const ok = () => Promise.resolve({ default: Hello });
const failing = () => Promise.reject(new TypeError(`Failed to fetch dynamically imported module: ${STALE_URL} ${HOSTILE_TEXT.bearer}`));

async function settle(loader: { read: (id: "a") => ComponentType }): Promise<unknown> {
  try {
    loader.read("a");
    return "ready";
  } catch (thrown) {
    if (thrown instanceof Promise) {
      await thrown;
      return settle(loader);
    }
    return thrown;
  }
}

describe("createScreenLoader", () => {
  it("imports once, throws the pending promise meanwhile, then returns the same component", async () => {
    const one = counting(ok);
    const loader = createScreenLoader({ a: one.load });
    expect(loader.state("a")).toBe("idle");
    let thrown: unknown;
    try {
      loader.read("a");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Promise);
    expect(loader.state("a")).toBe("pending");
    expect(() => loader.read("a")).toThrow();
    await thrown;
    expect(loader.state("a")).toBe("ready");
    expect(loader.read("a")).toBe(Hello);
    expect(loader.read("a")).toBe(Hello);
    expect(one.calls()).toBe(1);
  });

  it("keeps a failure as a ScreenLoadError with a fixed message and no URL, hash or body", async () => {
    const bad = counting(failing);
    const loader = createScreenLoader({ a: bad.load });
    const error = (await settle(loader)) as ScreenLoadError;
    expect(error).toBeInstanceOf(ScreenLoadError);
    expect(error).toMatchObject({ code: "SCREEN_LOAD_FAILED", screenId: "a", name: "ScreenLoadError" });
    expect(error.message).toBe("A screen file could not be loaded.");
    expect(JSON.stringify({ message: error.message, code: error.code, screenId: error.screenId, name: error.name })).not.toMatch(/example\.test|AbC12345|tok_FAKE|Bearer/);
    expect((error.cause as Error).message).toContain("AbC12345");
    expect(loader.state("a")).toBe("failed");
  });

  it("does not import again when React draws the failed slot again", async () => {
    const bad = counting(failing);
    const loader = createScreenLoader({ a: bad.load });
    const first = (await settle(loader)) as ScreenLoadError;
    for (let i = 0; i < 5; i += 1) {
      expect(() => loader.read("a")).toThrow(first);
    }
    expect(bad.calls()).toBe(1);
  });

  it("makes exactly one new import after forgetFailedScreens, and can then succeed", async () => {
    let healthy = false;
    const flaky = counting(() => (healthy ? ok() : failing()));
    const loader = createScreenLoader({ a: flaky.load });
    expect(await settle(loader)).toBeInstanceOf(ScreenLoadError);
    healthy = true;
    forgetFailedScreens();
    expect(loader.state("a")).toBe("idle");
    expect(await settle(loader)).toBe("ready");
    expect(loader.read("a")).toBe(Hello);
    expect(flaky.calls()).toBe(2);
  });

  it("leaves ready and pending screens alone when failed ones are forgotten", async () => {
    const good = counting(ok);
    const loader = createScreenLoader({ a: good.load });
    await settle(loader);
    forgetFailedScreens();
    expect(loader.state("a")).toBe("ready");
    expect(good.calls()).toBe(1);
  });

  it("treats a loader function that throws at once as a failed load", async () => {
    const loader = createScreenLoader({
      a: () => {
        throw new Error("sync boom");
      },
    });
    expect(await settle(loader)).toBeInstanceOf(ScreenLoadError);
  });

  it("preload settles every screen, failed ones included, and never rejects", async () => {
    const loader = createScreenLoader({ a: ok, b: failing });
    await expect(loader.preload()).resolves.toBeUndefined();
    expect(loader.state("a")).toBe("ready");
    expect(loader.state("b")).toBe("failed");
  });
});

describe("loading and failure on screen", () => {
  it("an unsettled screen draws the role=status note with the route label, not the screen", () => {
    const loader = createScreenLoader({ a: () => new Promise(() => undefined) });
    const html = renderToStaticMarkup(
      <Suspense fallback={<ScreenLoading label="Gift" />}>
        <ScreenSlot id="a" read={loader.read} />
      </Suspense>,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading Gift");
    expect(html).not.toMatch(/<h[1-6]/);
  });

  it("a settled screen draws the screen and no loading note", async () => {
    const loader = createScreenLoader({ a: ok });
    await loader.preload();
    const html = renderToStaticMarkup(
      <Suspense fallback={<ScreenLoading label="Gift" />}>
        <ScreenSlot id="a" read={loader.read} />
      </Suspense>,
    );
    expect(html).toBe("<p>hello screen</p>");
  });

  it("the classified fault for a load failure is its own kind and never the render-error kind", async () => {
    const loader = createScreenLoader({ a: failing });
    const fault = classifyFault(await settle(loader));
    expect(fault).toMatchObject({ kind: "screen-load-error", code: "SCREEN_LOAD_FAILED", requestId: null, correlationId: null });
    expect(Object.keys(fault).sort()).toEqual(["code", "correlationId", "kind", "reference", "requestId"]);
    expect(classifyFault(new CarryingError()).kind).toBe("render-error");
    expect(classifyFault({ code: "SCREEN_LOAD_FAILED" }).kind).toBe("render-error");
  });

  async function panel(scope: "route" | "app" = "route"): Promise<string> {
    const loader = createScreenLoader({ a: failing });
    const fault = classifyFault(await settle(loader));
    return renderToStaticMarkup(
      <MemoryRouter>
        <ErrorPanel fault={fault} scope={scope} screenLabel="Gift" onAgain={() => undefined} />
      </MemoryRouter>,
    );
  }

  it("the load panel names its cause, says it is not an UNKNOWN outcome, sent nothing, and offers again and home", async () => {
    const html = await panel();
    expect(html).toContain('data-cause="screen-load-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("This screen could not be loaded");
    expect(html).toContain("Screen load error");
    expect(html).toContain("SCREEN_LOAD_FAILED");
    expect(html).toContain("not an UNKNOWN outcome");
    expect(html).toContain("sent nothing and cleared nothing");
    expect(html).toContain("no desk request was sent");
    expect(html).toContain("Load this screen again");
    expect(html).toContain('id="shell-error-again"');
    expect(html).toContain("reload the page");
    expect(html).toContain("Go to Box office");
    expect(html).not.toContain("Render error");
    expect(html).not.toMatch(/example\.test|AbC12345|tok_FAKE|Bearer|\.js\b/);
  });

  it("the app-scope load panel uses a plain link home", async () => {
    expect(await panel("app")).toContain('<a href="/">Go to Box office</a>');
  });

  it("the boundary's again action forgets failed screens, so the next draw makes one new import", async () => {
    const bad = counting(failing);
    const loader = createScreenLoader({ a: bad.load });
    const error = await settle(loader);
    const boundary = new RenderBoundary({ scope: "route", resetKey: "k", screenLabel: "Gift", children: null });
    boundary.state = { fault: classifyFault(error), keyAtFault: "k" };
    const setState = vi.fn();
    boundary.setState = setState;
    const element = boundary.render() as { props: { onAgain: () => void } };
    expect(loader.state("a")).toBe("failed");
    element.props.onAgain();
    expect(setState).toHaveBeenCalledWith({ fault: null, keyAtFault: null });
    expect(loader.state("a")).toBe("idle");
    await settle(loader);
    expect(bad.calls()).toBe(2);
  });

  it("a move to another screen clears the fault and forgets failed screens", async () => {
    const loader = createScreenLoader({ a: failing });
    const error = await settle(loader);
    const boundary = new RenderBoundary({ scope: "route", resetKey: "next", screenLabel: "Gift", children: null });
    boundary.state = { fault: classifyFault(error), keyAtFault: "previous" };
    const setState = vi.fn();
    boundary.setState = setState;
    boundary.componentDidUpdate();
    expect(setState).toHaveBeenCalledWith({ fault: null, keyAtFault: null });
    expect(loader.state("a")).toBe("idle");
  });
});
