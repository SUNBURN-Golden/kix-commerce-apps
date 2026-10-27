import fs from "node:fs";
import path from "node:path";
import type { Browser, BrowserContext, Page, Request, Route } from "playwright-core";
import { recordDir } from "./record-dir";

/**
 * Browser, context and page accounting for one session, plus the work still pending when a test ends.
 *
 * Ownership: the session's first context is permanent and belongs to the file. Pages opened before the first
 * test (the visual helper page) belong to the file and close with the session. Everything opened while a test
 * runs belongs to that test and must be closed by it. A page or context a test leaves open is reported, then
 * closed by the harness so the next test starts clean.
 */

export interface LifecycleCounts {
  browsersOpened: number;
  browsersClosed: number;
  contextsOpened: number;
  contextsClosed: number;
  pagesOpened: number;
  pagesClosed: number;
}

/** What one test left behind. `leaked*` is read before the harness cleans up, `survivor*` after. */
export interface TestLifecycle {
  leakedPages: number;
  leakedContexts: number;
  survivorPages: number;
  survivorContexts: number;
  /** Playwright API calls still running (navigations, waits, evaluates), by API name. A losing `Promise.race` branch shows here. */
  pendingApiCalls: string[];
  /** Route handlers (page, context and the permanent loopback route) that had not returned. */
  pendingRoutes: number;
  /** Gates made by `gate()` that the test never released. The harness releases them. */
  unreleasedGates: number;
  /** Application network calls read from leaked pages before they were closed. */
  leakedPageNetworkCalls: number;
  cleanupErrors: number;
  /** Creation/closure deltas during this test, including harness cleanup. */
  counts: LifecycleCounts;
}

/** What a session still held when its file ended. */
export interface TeardownReport {
  leakedPages: number;
  leakedContexts: number;
  /** Pages the file opened before its first test. Expected; they close with the session. */
  fileScopePages: number;
  pendingApiCalls: string[];
  pendingRoutes: number;
  closeErrors: number;
}

/**
 * The leak check the per-test hook runs, after the harness has closed what was left. A page or context a test left
 * open fails that test. If the test body already failed, the leak is a consequence and is recorded, not asserted again.
 * What the harness could not close fails the test either way.
 */
export function assertNoLeaks(life: Pick<TestLifecycle, "leakedPages" | "leakedContexts" | "survivorPages" | "survivorContexts">, bodyFailed: boolean): void {
  if (!bodyFailed && life.leakedPages + life.leakedContexts > 0) {
    throw new Error(`This test left ${life.leakedPages} page(s) and ${life.leakedContexts} context(s) open. Close them in the test, in a finally block if an assertion can throw first.`);
  }
  if (life.survivorPages + life.survivorContexts > 0) {
    throw new Error(`The harness could not close ${life.survivorPages} page(s) and ${life.survivorContexts} context(s) this test left open.`);
  }
}

/** The file-level check the last hook runs. */
export function assertFileClean(report: Pick<TeardownReport, "leakedPages" | "leakedContexts">): void {
  if (report.leakedPages + report.leakedContexts > 0) {
    throw new Error(`${report.leakedPages} page(s) and ${report.leakedContexts} context(s) were still open when the file ended.`);
  }
}

export type LifecycleLine =
  | { kind: "session-open" }
  | ({ kind: "session-close"; file: string } & LifecycleCounts & Omit<TeardownReport, "pendingApiCalls"> & { pendingApiCalls: number })
  | ({ kind: "test"; file: string; name: string; bodyFailed: boolean } & Omit<TestLifecycle, "pendingApiCalls"> & { pendingApiCalls: string[] });

export function recordLifecycle(line: LifecycleLine): void {
  fs.appendFileSync(path.join(recordDir(), "lifecycle.jsonl"), JSON.stringify(line) + "\n");
}

export function readLifecycle(dir: string): LifecycleLine[] {
  const file = path.join(dir, "lifecycle.jsonl");
  if (!fs.existsSync(file)) {
    return [];
  }
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as LifecycleLine);
}

export interface LifecycleBlock extends LifecycleCounts {
  /** Keep test/file attribution and pending API names in the final record. */
  tests: Extract<LifecycleLine, { kind: "test" }>[];
  files: Extract<LifecycleLine, { kind: "session-close" }>[];
  sessions: number;
  testsTracked: number;
  /** Pages and contexts left open by tests whose body passed. A test whose body failed is counted separately. */
  leakedAtTestEnd: number;
  leakedInFailedTests: number;
  survivorsAfterCleanup: number;
  leakedAtTeardown: number;
  pendingApiCallsAtTestEnd: number;
  pendingRoutesAtTestEnd: number;
  unreleasedGatesAtTestEnd: number;
  pendingApiCallsAtTeardown: number;
  pendingRoutesAtTeardown: number;
  cleanupErrors: number;
  leakedPageNetworkCalls: number;
}

export function summarizeLifecycle(lines: readonly LifecycleLine[]): LifecycleBlock {
  const block: LifecycleBlock = {
    tests: [],
    files: [],
    sessions: 0,
    browsersOpened: 0,
    browsersClosed: 0,
    contextsOpened: 0,
    contextsClosed: 0,
    pagesOpened: 0,
    pagesClosed: 0,
    testsTracked: 0,
    leakedAtTestEnd: 0,
    leakedInFailedTests: 0,
    survivorsAfterCleanup: 0,
    leakedAtTeardown: 0,
    pendingApiCallsAtTestEnd: 0,
    pendingRoutesAtTestEnd: 0,
    unreleasedGatesAtTestEnd: 0,
    pendingApiCallsAtTeardown: 0,
    pendingRoutesAtTeardown: 0,
    cleanupErrors: 0,
    leakedPageNetworkCalls: 0,
  };
  for (const line of lines) {
    if (line.kind === "session-open") {
      block.sessions += 1;
      block.browsersOpened += 1;
    } else if (line.kind === "session-close") {
      block.files.push(line);
      block.browsersClosed += line.browsersClosed;
      block.contextsOpened += line.contextsOpened;
      block.contextsClosed += line.contextsClosed;
      block.pagesOpened += line.pagesOpened;
      block.pagesClosed += line.pagesClosed;
      block.leakedAtTeardown += line.leakedPages + line.leakedContexts;
      block.pendingApiCallsAtTeardown += line.pendingApiCalls;
      block.pendingRoutesAtTeardown += line.pendingRoutes;
      block.cleanupErrors += line.closeErrors;
    } else {
      block.tests.push(line);
      const leaked = line.leakedPages + line.leakedContexts;
      block.testsTracked += 1;
      if (line.bodyFailed) {
        block.leakedInFailedTests += leaked;
      } else {
        block.leakedAtTestEnd += leaked;
      }
      block.pendingApiCallsAtTestEnd += line.pendingApiCalls.length;
      block.pendingRoutesAtTestEnd += line.pendingRoutes;
      block.unreleasedGatesAtTestEnd += line.unreleasedGates;
      block.survivorsAfterCleanup += line.survivorPages + line.survivorContexts;
      block.cleanupErrors += line.cleanupErrors;
      block.leakedPageNetworkCalls += line.leakedPageNetworkCalls;
    }
  }
  return block;
}

/** The ways a lifecycle block can show a defect. Empty when every session closed clean. */
export function lifecycleProblems(block: LifecycleBlock, expectedSessions: number): string[] {
  const problems: string[] = [];
  if (block.sessions < expectedSessions) {
    problems.push(`lifecycle: ${block.sessions} browser sessions reported, ${expectedSessions} reported a ledger`);
  }
  const pairs: [string, number, number][] = [
    ["browsers", block.browsersOpened, block.browsersClosed],
    ["contexts", block.contextsOpened, block.contextsClosed],
    ["pages", block.pagesOpened, block.pagesClosed],
  ];
  for (const [what, opened, closed] of pairs) {
    if (opened !== closed) {
      problems.push(`lifecycle: ${opened} ${what} opened, ${closed} closed`);
    }
  }
  const counted: [string, number][] = [
    ["pages or contexts left open at the end of a test", block.leakedAtTestEnd],
    ["pages or contexts still open after the harness cleaned up", block.survivorsAfterCleanup],
    ["pages or contexts left open at the end of a file", block.leakedAtTeardown],
    ["Playwright calls still pending at the end of a test", block.pendingApiCallsAtTestEnd],
    ["route handlers still pending at the end of a test", block.pendingRoutesAtTestEnd],
    ["held gates never released by a test", block.unreleasedGatesAtTestEnd],
    ["Playwright calls still pending at the end of a file", block.pendingApiCallsAtTeardown],
    ["route handlers still pending at the end of a file", block.pendingRoutesAtTeardown],
    ["cleanup steps that failed or timed out", block.cleanupErrors],
  ];
  for (const [what, count] of counted) {
    if (count > 0) {
      problems.push(`lifecycle: ${count} ${what}`);
    }
  }
  return problems;
}

type UrlMatch = string | RegExp | ((url: URL) => boolean);
type RouteHandler = (route: Route, request: Request) => unknown;
type Routable = Pick<Page, "route" | "unroute">;

interface OwnedRoute {
  target: Page | BrowserContext;
  url: UrlMatch;
  handler: RouteHandler;
}

/** A promise a test can hold a route on. The harness releases any gate a test left closed. */
export interface Gate {
  opened: Promise<void>;
  release: () => void;
  readonly released: boolean;
}

interface ApiZone {
  apiName?: string;
}

interface Instrumentation {
  addListener: (listener: object) => void;
}

/**
 * Playwright's client keeps one instrumentation per connection, so one process-wide list of running API calls is
 * shared by every session of the file. A call is attributed to the test that was running when it was read.
 */
const runningApiCalls = new Map<ApiZone, string>();
const listening = new WeakSet<object>();
const API_LISTENER = {
  onApiCallBegin: (zone: ApiZone, info: { type: string; method: string }): void => {
    runningApiCalls.set(zone, zone.apiName ?? `${info.type}.${info.method}`);
  },
  onApiCallEnd: (zone: ApiZone): void => {
    runningApiCalls.delete(zone);
  },
};

function listenForApiCalls(browser: Browser): void {
  const instrumentation = (browser as unknown as { _instrumentation?: Instrumentation })._instrumentation;
  if (!instrumentation || typeof instrumentation.addListener !== "function") {
    throw new Error("playwright-core 1.58.2 client instrumentation was not found. The lifecycle record cannot count pending calls.");
  }
  if (!listening.has(instrumentation)) {
    listening.add(instrumentation);
    instrumentation.addListener(API_LISTENER);
  }
}

const SETUP = "setup";
const BETWEEN = "between";
/** No cleanup step may hold a hook for longer than this. A step that does not finish counts as a cleanup error. */
const STEP_MS = 5000;
/** Reading a leaked page's counter is evidence, not cleanup: a page stuck mid-navigation must not hold the hook for long. */
const EVIDENCE_MS = 1500;

async function within<T>(step: Promise<T>, what: string, limitMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      step,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`cleanup step did not finish in ${limitMs} ms: ${what}`)), limitMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const pageNetworkCalls = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __kixNet?: number }).__kixNet ?? 0);

export class SessionTracker {
  readonly counts: LifecycleCounts = { browsersOpened: 1, browsersClosed: 0, contextsOpened: 0, contextsClosed: 0, pagesOpened: 0, pagesClosed: 0 };
  /** The test file this session serves, for the record. */
  file = "raw-session";
  private scope = SETUP;
  private tests = 0;
  private startCounts: LifecycleCounts = { ...this.counts };
  private defaultContext: BrowserContext | null = null;
  private readonly pages = new Map<Page, string>();
  private readonly contexts = new Map<BrowserContext, { scope: string; closed: boolean; permanent: boolean }>();
  private readonly running = new Set<symbol>();
  private readonly owned: OwnedRoute[] = [];
  private readonly permanentHandlers = new WeakSet<RouteHandler>();
  private readonly gates = new Set<Gate>();
  private cleanupErrors = 0;
  private teardown: TeardownReport | null = null;

  /** `record: false` keeps a deliberate-leak self-test out of the run record. */
  constructor(
    private readonly browser: Browser,
    private readonly record: boolean,
  ) {
    listenForApiCalls(browser);
    browser.on("disconnected", () => {
      this.counts.browsersClosed = 1;
    });
    if (record) {
      recordLifecycle({ kind: "session-open" });
    }
  }

  /** Counts a context and its pages and starts tracking its routes. The first context adopted as default is permanent. */
  adopt(context: BrowserContext, permanent = false): void {
    const entry = { scope: this.scope, closed: false, permanent };
    this.contexts.set(context, entry);
    this.counts.contextsOpened += 1;
    if (permanent) {
      this.defaultContext = context;
    }
    context.on("close", () => {
      entry.closed = true;
      this.counts.contextsClosed += 1;
    });
    context.on("page", (page) => this.adoptPage(page));
    for (const page of context.pages()) {
      this.adoptPage(page);
    }
    this.trackRoutes(context);
  }

  /** Contexts opened later through `browser.newContext` are counted and owned by the test that opened them. */
  trackNewContexts(initialize: (context: BrowserContext) => Promise<void>): void {
    const original = this.browser.newContext.bind(this.browser);
    (this.browser as { newContext: Browser["newContext"] }).newContext = async (options) => {
      const context = await original({ ...options, serviceWorkers: "block", acceptDownloads: false });
      this.adopt(context);
      try {
        await initialize(context);
        return context;
      } catch (error) {
        await context.close();
        throw error;
      }
    };
  }

  private adoptPage(page: Page): void {
    if (this.pages.has(page)) {
      return;
    }
    this.pages.set(page, this.scope);
    this.counts.pagesOpened += 1;
    page.on("close", () => {
      this.counts.pagesClosed += 1;
    });
    this.trackRoutes(page);
  }

  /** Wraps `route` and `unroute` so a running handler is counted, and a route a test adds is removed after it. */
  private trackRoutes(target: Page | BrowserContext): void {
    const routable = target as Routable;
    const route = routable.route.bind(target) as (url: UrlMatch, handler: RouteHandler, options?: { times?: number }) => Promise<void>;
    const unroute = routable.unroute.bind(target) as (url: UrlMatch, handler?: RouteHandler) => Promise<void>;
    const inner = new Map<RouteHandler, RouteHandler>();
    routable.route = (async (url: UrlMatch, handler: RouteHandler, options?: { times?: number }) => {
      const counted = this.counted(handler);
      inner.set(handler, counted);
      if (this.scope !== SETUP && !this.permanentHandlers.has(handler)) {
        this.owned.push({ target, url, handler: counted });
      }
      return route(url, counted, options);
    }) as Routable["route"];
    routable.unroute = (async (url: UrlMatch, handler?: RouteHandler) => unroute(url, handler ? (inner.get(handler) ?? handler) : undefined)) as Routable["unroute"];
  }

  /** A session guard remains installed even if an extra context cannot close during test cleanup. */
  permanentRoute(handler: RouteHandler): RouteHandler {
    this.permanentHandlers.add(handler);
    return handler;
  }

  /** A route handler that is counted while it runs. */
  counted(handler: RouteHandler): RouteHandler {
    return async (route, request) => {
      const token = Symbol("route");
      this.running.add(token);
      try {
        return await handler(route, request);
      } finally {
        this.running.delete(token);
      }
    };
  }

  /** A closed gate. A test holds a route on `opened`; if it never calls `release`, the cleanup does. */
  gate(): Gate {
    let open: () => void = () => undefined;
    const opened = new Promise<void>((resolve) => {
      open = resolve;
    });
    const gate = {
      opened,
      released: false,
      release: () => {
        gate.released = true;
        open();
      },
    };
    this.gates.add(gate);
    return gate;
  }

  /** What is pending right now, without cleaning anything up. */
  pending(): { routes: number; apiCalls: string[] } {
    return { routes: this.running.size, apiCalls: [...runningApiCalls.values()].sort() };
  }

  beginTest(): void {
    this.startCounts = { ...this.counts };
    this.tests += 1;
    this.scope = `test-${this.tests}`;
  }

  private reconcile(): void {
    for (const context of this.contexts.keys()) {
      for (const page of context.pages()) {
        this.adoptPage(page);
      }
    }
  }

  private openPages(owned: (scope: string) => boolean): Page[] {
    return [...this.pages].filter(([page, scope]) => !page.isClosed() && owned(scope)).map(([page]) => page);
  }

  private openContexts(owned: (scope: string) => boolean): BrowserContext[] {
    return [...this.contexts].filter(([, entry]) => !entry.closed && !entry.permanent && owned(entry.scope)).map(([context]) => context);
  }

  private targetClosed(target: Page | BrowserContext): boolean {
    return "isClosed" in target ? target.isClosed() : this.contexts.get(target)?.closed !== false;
  }

  private async attempt(what: string, step: () => Promise<unknown>, limitMs: number = STEP_MS): Promise<void> {
    try {
      await within(step(), what, limitMs);
    } catch {
      this.cleanupErrors += 1;
    }
  }

  /**
   * Reads what the test left pending and open, then cleans up: gates released, leftover pages and contexts
   * closed, test-owned routes removed, the permanent context put back online. Every step is attempted.
   * The permanent loopback route is not a test-owned route and stays.
   */
  async endTest(): Promise<TestLifecycle> {
    // Read once: `this.scope` becomes BETWEEN before the survivor counts below, and the test's own entries must still match.
    const testScope = this.scope;
    const mine = (scope: string) => scope === testScope || scope === BETWEEN;
    this.cleanupErrors = 0;
    this.reconcile();
    const pendingApiCalls = [...runningApiCalls.values()].sort();
    const pendingRoutes = this.running.size;
    const unreleasedGates = [...this.gates].filter((gate) => !gate.released).length;
    const leakedPages = this.openPages(mine);
    const leakedContexts = this.openContexts(mine);
    // Held routes are released first, so a page stuck on one can answer the counter read before it is closed.
    for (const gate of this.gates) {
      gate.release();
    }
    this.gates.clear();
    let leakedPageNetworkCalls = 0;
    for (const page of leakedPages) {
      await this.attempt(
        "read network calls of a leaked page",
        async () => {
          leakedPageNetworkCalls += await pageNetworkCalls(page);
        },
        EVIDENCE_MS,
      );
    }
    for (const context of leakedContexts) {
      await this.attempt("close a leaked context", () => context.close());
    }
    for (const page of leakedPages) {
      if (!page.isClosed()) {
        await this.attempt("close a leaked page", () => page.close());
      }
    }
    for (const route of this.owned.splice(0)) {
      if (!this.targetClosed(route.target)) {
        await this.attempt("remove a test route", () => (route.target as Routable).unroute(route.url, route.handler));
      }
    }
    const permanent = this.defaultContext;
    if (permanent && this.contexts.get(permanent)?.closed === false) {
      await this.attempt("put the context back online", () => permanent.setOffline(false));
    }
    this.scope = BETWEEN;
    return {
      leakedPages: leakedPages.length,
      leakedContexts: leakedContexts.length,
      survivorPages: this.openPages(mine).length,
      survivorContexts: this.openContexts(mine).length,
      pendingApiCalls,
      pendingRoutes,
      unreleasedGates,
      leakedPageNetworkCalls,
      cleanupErrors: this.cleanupErrors,
      counts: Object.fromEntries(Object.entries(this.counts).map(([key, value]) => [key, value - this.startCounts[key as keyof LifecycleCounts]])) as unknown as LifecycleCounts,
    };
  }

  /** At the end of the file: reads what is still open, then closes it so the browser can close. */
  async closeSession(): Promise<TeardownReport> {
    this.reconcile();
    const isFileScope = (scope: string) => scope === SETUP;
    const leakedPages = this.openPages((scope) => !isFileScope(scope));
    const leakedContexts = this.openContexts(() => true);
    const report: TeardownReport = {
      leakedPages: leakedPages.length,
      leakedContexts: leakedContexts.length,
      fileScopePages: this.openPages(isFileScope).length,
      pendingApiCalls: [...runningApiCalls.values()].sort(),
      pendingRoutes: this.running.size,
      closeErrors: 0,
    };
    for (const gate of this.gates) {
      gate.release();
    }
    this.gates.clear();
    this.cleanupErrors = 0;
    for (const context of leakedContexts) {
      await this.attempt("close a leftover context", () => context.close());
    }
    for (const page of leakedPages) {
      if (!page.isClosed()) {
        await this.attempt("close a leftover page", () => page.close());
      }
    }
    report.closeErrors = this.cleanupErrors;
    this.teardown = report;
    return report;
  }

  /** Writes the session line once the browser has closed. */
  finish(): void {
    if (!this.browser.isConnected()) {
      this.counts.browsersClosed = 1;
    }
    if (!this.record) {
      return;
    }
    const report = this.teardown ?? { leakedPages: 0, leakedContexts: 0, fileScopePages: 0, pendingApiCalls: [], pendingRoutes: 0, closeErrors: 0 };
    recordLifecycle({ kind: "session-close", file: this.file, ...this.counts, ...report, pendingApiCalls: report.pendingApiCalls.length });
  }

  /** Writes one test line. */
  recordTest(name: string, bodyFailed: boolean, life: TestLifecycle): void {
    if (this.record) {
      recordLifecycle({ kind: "test", file: this.file, name, bodyFailed, ...life });
    }
  }
}
