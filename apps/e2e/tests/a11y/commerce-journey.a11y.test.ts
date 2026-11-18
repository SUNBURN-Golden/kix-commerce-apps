import { expect, it } from "vitest";
import { A11Y_BASELINE, VIEWPORTS } from "../../src/a11y-matrix";
import { runAxe } from "../../src/a11y-axe";
import { useBrowser } from "../../src/suite";

const suite = useBrowser();
it("the booking fixture's active controls and read refusal have no axe violations at 320px", async () => {
  const page = await suite.newPage();
  await page.setViewportSize(VIEWPORTS.narrow);
  await page.goto(suite.origin + "/booking/evt_lanterns?lang=en");
  const panel = page.getByRole("region", { name: "Protocol commerce journey" });
  await panel.locator("[data-commerce-branch=admission]").click();
  await panel.getByRole("button", { name: "Read current booking" }).click();
  await panel.getByText("NOT_BOUND", { exact: true }).waitFor();
  const result = await runAxe(page, A11Y_BASELINE.tags);
  expect(result.violations.map((rule) => rule.ruleId)).toEqual([]);
  await suite.pass(page, "booking.pinned-commerce-journey.a11y");
  await page.close();
});
