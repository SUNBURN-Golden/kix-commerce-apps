import { expect, test } from "@playwright/test";

test("box office and booking expose receipts and isolate scenarios", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/");
  const panel = page.getByRole("region", { name: "Inspect the booking journey" });
  await expect(panel.getByRole("status")).toContainText("No journey has been run");
  await panel.getByRole("button", { name: "Run selected simulation" }).focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByRole("status")).toContainText("Synthetic journey complete");
  await panel.getByText("Receipt · demo-prepare").click();
  await expect(panel.locator("pre").filter({ hasText: '"status": "PREPARED"' })).toBeVisible();
  await panel.getByText("Receipt · demo-admit").click();
  await expect(panel.locator("pre").filter({ hasText: '"decision": "ADMITTED_ONCE"' })).toBeVisible();

  for (const [scenario, outcome] of [["response-loss", "UNKNOWN"], ["rejected", "REJECTED"], ["stale", "STALE_RESPONSE"], ["malformed", "INVALID_RECEIPT"]]) {
    await panel.getByLabel("Simulation scenario").selectOption(scenario!);
    await expect(panel.getByRole("status")).toContainText("No journey has been run");
    await panel.getByRole("button", { name: "Run selected simulation" }).click();
    await expect(panel.getByRole("status")).toContainText("Last confirmed step: create_event");
    await expect(panel.locator("ol")).toContainText(outcome!);
    await expect(panel.locator("ol li").last()).toHaveText("admit — Not attempted");
  }
  for (const [scenario, last, outcome] of [
    ["capture-loss", "accept_trade", "UNKNOWN"], ["commit-loss", "capture", "UNKNOWN"],
    ["stale-presentation", "open_admission", "REJECTED"], ["malformed-commit", "capture", "INVALID_RECEIPT"],
  ]) {
    await panel.getByLabel("Simulation scenario").selectOption(scenario!);
    await panel.getByRole("button", { name: "Run selected simulation" }).click();
    await expect(panel.getByRole("status")).toContainText(`Last confirmed step: ${last}`);
    await expect(panel.locator("ol")).toContainText(outcome!);
    await expect(panel.getByRole("status")).not.toContainText("Synthetic journey complete");
  }
  await page.reload();
  await expect(panel.getByRole("status")).toContainText("No journey has been run");
  await page.getByRole("link", { name: "Book", exact: true }).first().click();
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Run selected simulation" }).click();
  await expect(panel.getByRole("status")).toContainText("No real funds, ticket or entry");
});

test("mobile fixture has no horizontal page overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:5173/");
  const panel = page.getByRole("region", { name: "Inspect the booking journey" });
  await panel.getByRole("button", { name: "Run selected simulation" }).click();
  await panel.getByText("Receipt · demo-create").click();
  await expect(panel.getByRole("status")).toContainText("Synthetic journey complete");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.screenshot({ path: testInfo.outputPath("mobile-journey.png") });
});

test("HTTP box office and booking stay unavailable without a journey POST", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST") posts.push(request.url()); });
  for (const route of ["/", "/booking/unavailable-show"]) {
    await page.goto(`http://127.0.0.1:5174${route}`);
    const panel = page.getByRole("region", { name: "Inspect the booking journey" });
    await expect(panel).toContainText("Browser HTTP journey unavailable");
    await expect(panel.getByRole("button")).toHaveCount(0);
    await expect(panel).not.toContainText("Confirmed in simulation");
  }
  expect(posts).toEqual([]);
});


test("unknown events leave loading and expose a return path", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/booking/missing-event");
  await expect(page.getByRole("alert")).toContainText("That performance is not on this adapter");
  await expect(page.getByText("Loading the performance.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to the window" })).toBeVisible();
});


test("local desk links booking through resale to the correct admission event", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/");
  const book = page.getByRole("link", { name: "Book", exact: true }).first();
  const bookingPath = await book.getAttribute("href");
  const eventId = bookingPath!.split("/").at(-1)!;
  await book.click();
  await page.getByRole("button", { name: "Place hold", exact: true }).click();
  await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(page.getByText("Simulated — no funds", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "List for resale", exact: true }).click();
  await page.getByRole("button", { name: "Open listing", exact: true }).click();
  await page.getByRole("button", { name: "Transfer (simulated)", exact: true }).click();
  await page.getByRole("link", { name: "Check the new right", exact: true }).click();
  await expect(page.getByLabel("Performance id", { exact: true })).toHaveValue(eventId);
  await expect(page.getByText(/Linked right reference/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mock admission credential", exact: true })).toBeVisible();
});

test("an event route transition does not retain the previous booking", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/");
  const books = page.getByRole("link", { name: "Book", exact: true });
  const second = await books.nth(1).getAttribute("href");
  await books.first().click();
  await page.getByRole("button", { name: "Place hold", exact: true }).click();
  await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(page.getByText("Confirmed in the adapter", { exact: true })).toBeVisible();
  await page.evaluate((url) => { history.pushState({}, "", url); dispatchEvent(new PopStateEvent("popstate")); }, second!);
  await expect(page.getByRole("button", { name: "Place hold", exact: true })).toBeVisible();
  await expect(page.getByText("Confirmed in the adapter", { exact: true })).toHaveCount(0);
});
