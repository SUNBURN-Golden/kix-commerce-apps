import type { Locator, Page } from "playwright-core";

/** Shared page helpers. Navigation uses in-app links: desk state is module-level and a full load clears it. */

export const EVENTS = {
  lanterns: { id: "evt_lanterns", title: "North Station Lanterns", row: 0 },
  orchestra: { id: "evt_paper_orchestra", title: "Paper Orchestra", row: 1 },
  ferry: { id: "evt_last_ferry", title: "Last Ferry Diagram", row: 2 },
} as const;

export type EventKey = keyof typeof EVENTS;

export async function goHome(page: Page, origin: string): Promise<void> {
  await page.goto(origin + "/");
  await page.getByRole("heading", { name: "Tonight’s window" }).waitFor();
}

export async function nav(page: Page, name: string): Promise<void> {
  await page.getByRole("navigation").getByRole("link", { name, exact: true }).click();
}

export function panel(page: Page, label: string): Locator {
  return page.getByRole("complementary", { name: label });
}

/** Clicks one button. Playwright waits for it to be enabled. */
export async function press(scope: Locator | Page, name: string): Promise<void> {
  const button = scope.getByRole("button", { name, exact: true });
  await button.click();
}

export async function fact(scope: Locator, label: string): Promise<string> {
  const term = scope.locator("dt").filter({ hasText: new RegExp(`^${label}$`, "i") }).first();
  return (await term.locator("xpath=following-sibling::dd[1]").innerText()).trim();
}

export async function alertTexts(page: Page): Promise<string[]> {
  return (await page.getByRole("alert").allInnerTexts()).map((text) => text.trim());
}

/** Polls page state until it holds. Never a fixed sleep; a failure throws with the last value. */
export async function poll<T>(read: () => Promise<T>, ok: (value: T) => boolean, what: string, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  for (;;) {
    last = await read();
    if (ok(last)) {
      return last;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${what}. Last value: ${JSON.stringify(last)?.slice(0, 300)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** Waits until a fact reads a value. */
export async function expectFact(scope: Locator, label: string, value: string | RegExp): Promise<void> {
  const dd = scope.locator("dt").filter({ hasText: new RegExp(`^${label}$`, "i") }).first().locator("xpath=following-sibling::dd[1]");
  await poll(
    async () => (await dd.innerText()).trim(),
    (text) => (typeof value === "string" ? text === value : value.test(text)),
    `${label} = ${String(value)}`,
  );
}

/** Mock settlement for one event through COMMITTED on the box office. */
export async function commitSettlement(page: Page, event: EventKey): Promise<void> {
  await nav(page, "Box office");
  await page.getByRole("button", { name: "Mock settlement" }).nth(EVENTS[event].row).click();
  const settlement = page.locator("aside", { hasText: "Mock settlement case" });
  const steps: [string, string][] = [
    ["Initiate mock case", "INITIATED"],
    ["Authorize mock phase", "AUTHORIZED"],
    ["Simulate CAPTURED phase", "CAPTURED"],
    ["Simulate COMMITTED phase", "COMMITTED"],
  ];
  for (const [button, phase] of steps) {
    await press(settlement, button);
    await expectFact(settlement, "Mock phase", phase);
  }
}

/** Place hold and Confirm on the booking screen, then the reservation panel through Issue. */
export async function bookAndIssue(page: Page, event: EventKey): Promise<void> {
  await nav(page, "Box office");
  await page.getByRole("link", { name: "Book" }).nth(EVENTS[event].row).click();
  await press(page, "Place hold");
  await press(page, "Confirm booking");
  await page.getByText("Confirmed in the adapter").waitFor();
  const reservation = panel(page, "Mock reservation case");
  const steps: [string, string][] = [
    ["Register mock show", ""],
    ["Hold mock slot", "HELD"],
    ["Confirm mock order", "CONFIRMED"],
    ["Note simulated payment", "PAYMENT_NOTED"],
    ["Bind mock settlement", "PAYMENT_NOTED"],
    ["Issue mock right", "ISSUED"],
  ];
  for (const [button, phase] of steps) {
    await press(reservation, button);
    if (phase === "") {
      await reservation.getByRole("button", { name: "Hold mock slot", exact: true }).waitFor();
      await expectEnabled(reservation.getByRole("button", { name: "Hold mock slot", exact: true }));
    } else {
      await expectFact(reservation, "Mock phase", phase);
    }
  }
}

export async function expectEnabled(button: Locator): Promise<void> {
  await poll(() => button.isEnabled(), (enabled) => enabled, "an enabled button");
}

export const RULING = "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

/** Every screen says stub. A test that cannot see this banner is not testing stub mode. */
export async function expectStubBanner(page: Page): Promise<void> {
  await page.getByText("Adapter stub. Environment stub.", { exact: false }).first().waitFor();
}

export async function bodyText(page: Page): Promise<string> {
  return (await page.locator("#root").textContent()) ?? "";
}

/** Asserts that the page shows the text, and fails with a short excerpt of the page when it does not. */
export async function expectText(page: Page, text: string | RegExp): Promise<void> {
  const body = await poll(
    () => bodyText(page),
    (current) => (typeof text === "string" ? current.includes(text) : text.test(current)),
    `page text ${String(text)}`,
  );
  void body;
}

export async function expectNoButton(scope: Locator | Page, name: RegExp): Promise<void> {
  const count = await scope.getByRole("button", { name }).count();
  if (count !== 0) {
    throw new Error(`Found ${count} button(s) matching ${String(name)}. That control must not exist.`);
  }
}

export async function newDeskPage(newPage: () => Promise<Page>, origin: string): Promise<Page> {
  const page = await newPage();
  await goHome(page, origin);
  await expectStubBanner(page);
  return page;
}

/** The send controls the M2 ruling bans. None may exist on any screen. */
export const BANNED_SEND = /^Send (capture|settle_capture|commit_trade|open_admission|admit)$/;

/** One step row of a journey, gift or organizer panel. */
export function stepRow(scope: Locator | Page, step: string): Locator {
  const page = "page" in scope && typeof scope.page === "function" ? scope.page() : (scope as Page);
  return scope.locator("li.journey-step").filter({ has: page.locator("p", { hasText: new RegExp(`^${step}$`) }) });
}

export async function expectStepStatus(row: Locator, status: string): Promise<void> {
  await poll(() => row.getAttribute("data-status"), (current) => current === status, `step status ${status}`);
}
