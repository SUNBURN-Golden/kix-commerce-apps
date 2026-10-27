import fs from "node:fs";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
import { SessionTracker, type TeardownReport } from "./lifecycle";

export interface Ledger {
  /** Requests the browser tried to send to any origin other than the loopback server. Blocked. */
  nonLoopback: string[];
  /** Requests with a method other than GET. */
  nonGet: string[];
  /** fetch, XHR, sendBeacon and WebSocket calls made by page scripts. */
  appNetworkCalls: number;
}

export interface Session {
  browser: Browser;
  context: BrowserContext;
  ledger: Ledger;
  version: string;
  /** Counts the browser, contexts and pages of this session and what a test leaves pending or open. */
  tracker: SessionTracker;
  /** Closes the session. Returns what the file still held open or pending just before. */
  close: () => Promise<TeardownReport>;
}

function chromePath(): string {
  const fromEnv = process.env.KIX_E2E_CHROME;
  if (fromEnv) {
    if (!fs.existsSync(fromEnv)) {
      throw new Error(`KIX_E2E_CHROME does not exist: ${fromEnv}`);
    }
    return fromEnv;
  }
  for (const candidate of ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("No Chrome found. Set KIX_E2E_CHROME to a Chrome or Chromium binary. The suite never skips.");
}

const COUNTER = `
(() => {
  const w = window;
  w.__kixNet = 0;
  const bump = () => { w.__kixNet += 1; };
  const f = w.fetch;
  w.fetch = function () { bump(); return f.apply(this, arguments); };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function () { bump(); return open.apply(this, arguments); };
  if (navigator.sendBeacon) {
    const b = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function () { bump(); return b.apply(null, arguments); };
  }
  const WS = w.WebSocket;
  w.WebSocket = function () { bump(); return new WS(...arguments); };
})();
`;

/** Launch flags that keep the browser on the loopback server. A caller can add flags, never remove or override these. */
export const LOOPBACK_ARGS = ["--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1", "--no-proxy-server"] as const;

const RESERVED_ARG_PREFIXES = ["--host-resolver-rules", "--no-proxy-server", "--proxy-", "--no-sandbox", "--remote-debugging", "--disable-web-security", "--user-data-dir"];

/** Environment names a suite may not set on the browser: anything that could reroute traffic or load outside code. */
const RESERVED_ENV_NAMES = /proxy|^LD_|^DYLD_/i;

/** Extra launch flags, environment and fixed context settings a suite may pin. Everything else about the session stays fixed. */
export interface SessionOptions {
  args?: readonly string[];
  env?: Record<string, string>;
  context?: Pick<BrowserContextOptions, "timezoneId" | "locale" | "deviceScaleFactor" | "reducedMotion">;
  /** False keeps this session's lifecycle out of the run record. Only the harness self-test sets it. */
  recordLifecycle?: boolean;
}

/** The final launch flags. A caller flag that touches the network, proxy, sandbox or profile is refused, not merged. */
export function launchArgs(extra: readonly string[] = []): string[] {
  for (const arg of extra) {
    if (RESERVED_ARG_PREFIXES.some((prefix) => arg.startsWith(prefix))) {
      throw new Error(`Launch flag is reserved by the harness: ${arg}`);
    }
  }
  const args = [...LOOPBACK_ARGS, ...extra];
  if (process.env.KIX_E2E_NO_SANDBOX === "1") {
    args.push("--no-sandbox");
  }
  return args;
}

/** The browser process environment: the caller's merged over this process's. A reserved name is refused, not merged. */
export function launchEnv(extra: Record<string, string> = {}): Record<string, string> {
  for (const name of Object.keys(extra)) {
    if (RESERVED_ENV_NAMES.test(name)) {
      throw new Error(`Launch environment is reserved by the harness: ${name}`);
    }
  }
  return { ...(process.env as Record<string, string>), ...extra };
}

export async function openSession(origin: string, extraOrigins: readonly string[] = [], options: SessionOptions = {}): Promise<Session> {
  const allowed = new Set([origin, ...extraOrigins]);
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true, args: launchArgs(options.args), env: launchEnv(options.env) });
  let tracker: SessionTracker;
  try {
    tracker = new SessionTracker(browser, options.recordLifecycle !== false);
  } catch (error) {
    await browser.close();
    throw error;
  }
  try {
    const ledger: Ledger = { nonLoopback: [], nonGet: [], appNetworkCalls: 0 };
    const initialize = async (context: BrowserContext): Promise<void> => {
      await context.route("**/*", tracker.permanentRoute((route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (!allowed.has(url.origin)) {
          ledger.nonLoopback.push(`${request.method()} ${url.origin}`);
          return route.abort();
        }
        if (request.method() !== "GET") {
          ledger.nonGet.push(`${request.method()} ${url.pathname}`);
        }
        return route.continue();
      }));
      await context.addInitScript(COUNTER);
    };
    const context = await browser.newContext({ ...options.context, serviceWorkers: "block", acceptDownloads: false });
    tracker.adopt(context, true);
    await initialize(context);
    tracker.trackNewContexts(initialize);
    return {
      browser,
      context,
      ledger,
      version: browser.version(),
      tracker,
      close: async () => {
        try {
          const report = await tracker.closeSession();
          await context.close();
          return report;
        } finally {
          try {
            await browser.close();
          } finally {
            tracker.finish();
          }
        }
      },
    };
  } catch (error) {
    try {
      await browser.close();
    } finally {
      tracker.finish();
    }
    throw error;
  }
}

export async function networkCalls(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __kixNet: number }).__kixNet);
}
