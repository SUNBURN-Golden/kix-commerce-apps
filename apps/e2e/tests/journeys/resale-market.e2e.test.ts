import type {} from "../../src/resale-fault-types";
import { describe, expect, it } from "vitest";
import { useBrowser } from "../../src/suite";
import { poll, newDeskPage } from "../../src/desk";
describe("synthetic resale marketplace", () => {
  const suite = useBrowser();
  it("searches bilingual fixtures and paginates without requests", async () => {
    const page = await newDeskPage(suite.newPage,suite.origin);
    await page.goto(suite.origin + "/resale/market");
    await page.getByRole("heading",{ name: "Orbit object" }).waitFor();
    await page.getByRole("button",{ name: "Next page" }).click(); await page.getByRole("heading",{ name: "Arc object" }).waitFor();
    await page.getByLabel("Search products").fill("궤도"); await page.getByRole("button",{ name: "Search", exact: true }).click(); await page.getByRole("heading",{ name: "Orbit object" }).waitFor();
    await page.getByLabel("Search products").fill("absent"); await page.getByRole("button",{ name: "Search", exact: true }).click(); await page.getByText("No synthetic products found. Change your search.").waitFor();
    await suite.pass(page,"resale-market.SUCCESS"); await page.close();
  });
  it.each(["en", "ko"] as const)("preserves committed searches through product, reload and browser history (%s)", async lang => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixResaleFault = { mode: "reject", dispatches: 0 }; });
    await page.goto(suite.faultOrigin + `/resale/market?lang=${lang}`);
    const search = lang === "ko" ? "상품 검색" : "Search products";
    const commit = lang === "ko" ? "검색" : "Search";
    const next = lang === "ko" ? "다음 페이지" : "Next page";
    const title = lang === "ko" ? "리셀 마켓" : "Resale market";
    const arc = lang === "ko" ? "아치 오브제" : "Arc object";
    for (const query of ["object", "오브제"]) {
      await page.getByLabel(search).fill(query); await page.getByRole("button", { name: commit, exact: true }).click();
      await page.getByRole("button", { name: next }).click(); await page.getByRole("heading", { name: arc }).waitFor();
      const expected = `?lang=${lang}&q=${encodeURIComponent(query)}&page=2`;
      expect(new URL(page.url()).search).toBe(expected);
      const card = page.locator(".market-card"); expect(await card.getAttribute("href")).toBe(`/resale/market/demo-003${expected}`);
      await card.click(); await page.getByLabel(lang === "ko" ? "거래 방식" : "Action", { exact: true }).waitFor();
      const back = page.getByRole("link", { name: title, exact: true }).last(); expect(await back.getAttribute("href")).toBe(`/resale/market${expected}`);
      await suite.quiet(page, "product navigation"); await back.click(); await page.getByRole("heading", { name: arc }).waitFor();
      expect(await page.getByLabel(search).inputValue()).toBe(query);
      expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
      await suite.quiet(page, "return navigation"); await page.reload(); await page.getByRole("heading", { name: arc }).waitFor();
      expect(await page.getByLabel(search).inputValue()).toBe(query); expect(new URL(page.url()).search).toBe(expected);
      await page.getByLabel(search).fill("absent"); await page.getByRole("button", { name: commit, exact: true }).click();
      await page.getByText(lang === "ko" ? "합성 상품이 없습니다. 검색어를 바꾸세요." : "No synthetic products found. Change your search.").waitFor();
      await page.goBack(); await page.getByRole("heading", { name: arc }).waitFor(); expect(await page.getByLabel(search).inputValue()).toBe(query);
      await page.goForward(); await poll(() => page.getByLabel(search).inputValue(), value => value === "absent", "forward restores committed query");
      expect(new URL(page.url()).searchParams.has("page")).toBe(false);
      expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
    }
    await suite.quiet(page, "read navigation only"); await page.close();
  });
  it.each(["en", "ko"] as const)("cleans malformed and unavailable URLs with localized feedback (%s)", async lang => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    for (const bad of ["q=a&q=b&page=2", "q=" + "x".repeat(101), "page=0", "page=1.5", "page=2&page=3", "amount=120&quoteId=x&operationId=y&outcome=CONFIRMED&return=https://example.com", "page=999"]) {
      await suite.quiet(page, "before independent load");
      await page.goto(suite.origin + `/resale/market?lang=${lang}&${bad}`);
      await page.locator("[data-market-read-notice]").waitFor();
      await poll(async () => new URL(page.url()).search, value => value === `?lang=${lang}`, "canonical safe URL");
      expect(await page.locator("[data-market-read-notice]").innerText()).toContain(lang === "ko" ? "검색 조건을 초기화" : "search context was reset");
    }
    await page.goto(suite.origin + `/resale/market/demo-003?lang=${lang}&q=object&page=2&capture=true`);
    await page.locator("[data-market-read-notice]").waitFor();
    expect(await page.getByRole("link", { name: lang === "ko" ? "리셀 마켓" : "Resale market", exact: true }).last().getAttribute("href")).toBe(`/resale/market?lang=${lang}&q=object&page=2`);
    await suite.quiet(page, "malformed read context"); await page.close();
  });
  it("reviews and records bids, asks and both instant sides; navigation retains state", async () => {
    const page = await newDeskPage(suite.newPage,suite.origin); await page.goto(suite.origin + "/resale/market/demo-001");
    await page.getByLabel("Action",{ exact: true }).waitFor();
    await suite.session().context.setOffline(true);
    await page.locator('[data-connectivity-state="offline"]').waitFor();
    await suite.session().context.setOffline(false);
    await page.locator('[data-connectivity-state="local"]').waitFor();
    expect(await page.getByRole("button",{ name: /^Review simulation/ }).getAttribute("aria-disabled")).toBe("true");
    await page.getByRole("button",{ name: "Read current fixtures" }).click();
    expect(await page.getByRole("button",{ name: "Review simulation", exact: true }).getAttribute("aria-disabled")).not.toBe("true");
    for (const kind of ["bid","ask","instant-buy","instant-sell"]) {
      await page.getByLabel("Action",{ exact: true }).selectOption(kind);
      await page.getByRole("button",{ name: "Review simulation" }).click(); await page.getByRole("heading",{ name: "Review simulation" }).waitFor();
      await page.getByRole("button",{ name: "Record simulation once" }).click(); await page.locator('[data-market-outcome="CONFIRMED"]').waitFor();
      await page.getByLabel("Action",{ exact: true }).waitFor();
    }
    expect(await page.getByText("Simulated trade",{ exact: true }).count()).toBe(3);
    await page.getByRole("link",{ name: "Resale market", exact: true }).last().click();
    await page.getByRole("link").filter({ has: page.getByRole("heading",{ name: "Orbit object" }) }).click();
    await page.getByLabel("Action",{ exact: true }).waitFor();
    expect(await page.getByText("Simulated trade",{ exact: true }).count()).toBe(3);
    await page.getByLabel("Action",{ exact: true }).selectOption("instant-buy"); expect(await page.getByRole("button",{ name: "Review simulation" }).isDisabled()).toBe(true);
    await suite.pass(page,"resale-product.SUCCESS"); await page.close();
  });
  it.each(["reject","lost","wrong-side","held"] as const)("isolates test-only %s responses and counts one dispatch", async mode => {
    const page = await suite.newPage(); await page.addInitScript((mode) => { window.__kixResaleFault = { mode, dispatches: 0 }; },mode);
    await page.goto(suite.faultOrigin + "/resale/market/demo-001");
    await page.getByRole("button",{ name: "Review simulation" }).click();
    const submit = page.getByRole("button",{ name: "Record simulation once" });
    await submit.focus(); await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
    if (mode === "held") {
      await page.getByRole("link",{ name: "Resale market", exact: true }).last().click();
      await page.evaluate(() => window.__kixResaleFault?.release?.());
      await page.getByRole("link").filter({ has: page.getByRole("heading",{ name: "Orbit object" }) }).click();
    await page.getByLabel("Action",{ exact: true }).waitFor();
    }
    const result = mode === "reject" ? "REJECTED" : "UNKNOWN";
    await page.locator(`[data-market-outcome="${result}"]`).waitFor();
    expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(1);
    if (result === "UNKNOWN") {
      await suite.session().context.setOffline(true);
    await page.locator('[data-connectivity-state="offline"]').waitFor(); await suite.session().context.setOffline(false);
    await page.locator('[data-connectivity-state="local"]').waitFor();
      await page.getByRole("button",{ name: "Read current fixtures" }).click();
      await page.locator('[data-locale="ko"]').click();
      await page.locator('[data-market-outcome="UNKNOWN"]').waitFor();
      await page.getByRole("link", { name: "리셀 마켓", exact: true }).last().click();
      await page.getByLabel("상품 검색").fill("궤도"); await page.getByRole("button", { name: "검색", exact: true }).click();
      await poll(() => page.locator(".market-card").count(), count => count === 1, "committed query result");
      await page.locator(".market-card").click(); await page.locator('[data-market-outcome="UNKNOWN"]').waitFor();
      expect(await page.getByRole("button",{ name: "모의 거래 검토" }).isDisabled()).toBe(true);
      expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(1);
    }
    await suite.pass(page,mode === "reject" ? "resale-product.REJECT" : mode === "lost" ? "resale-product.UNKNOWN" : `resale-product.${mode}`); await page.close();
  });
});
