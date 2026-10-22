import fs from "node:fs";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";

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
  close: () => Promise<void>;
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

/** Extra launch flags and fixed context settings a suite may pin. Everything else about the session stays fixed. */
export interface SessionOptions {
  args?: readonly string[];
  context?: Pick<BrowserContextOptions, "timezoneId" | "locale" | "deviceScaleFactor" | "reducedMotion">;
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

export async function openSession(origin: string, extraOrigins: readonly string[] = [], options: SessionOptions = {}): Promise<Session> {
  const allowed = new Set([origin, ...extraOrigins]);
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true, args: launchArgs(options.args) });
  const context = await browser.newContext({ ...options.context, serviceWorkers: "block", acceptDownloads: false });
  const ledger: Ledger = { nonLoopback: [], nonGet: [], appNetworkCalls: 0 };
  await context.route("**/*", (route) => {
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
  });
  await context.addInitScript(COUNTER);
  return {
    browser,
    context,
    ledger,
    version: browser.version(),
    close: async () => {
      await context.close();
      await browser.close();
    },
  };
}

export async function networkCalls(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __kixNet: number }).__kixNet);
}
