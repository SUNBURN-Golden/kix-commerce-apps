import type {} from "../../src/resale-fault-types";
import { describe, expect, it } from "vitest";
import { useBrowser } from "../../src/suite";
import { poll, newDeskPage } from "../../src/desk";
describe("synthetic resale marketplace", () => {
  const suite = useBrowser();
  it.each((["ko", "en"] as const).flatMap(lang => (["bid", "ask"] as const).map(kind => ({ lang, kind }))))("preserves exact units through review, source records and offers ($lang/$kind)", async ({ lang, kind }) => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixResaleFault = { mode: "normal", dispatches: 0 }; });
    await page.goto(suite.faultOrigin + `/resale/market/demo-001?lang=${lang}`);
    await page.locator("#market-action").selectOption(kind);
    const review = page.getByRole("button", { name: lang === "ko" ? "모의 거래 검토" : "Review simulation" });
    const confirm = page.getByRole("button", { name: lang === "ko" ? "모의 거래 한 번 기록" : "Record simulation once" });
    const values = ["0", "9007199254740993", "12345678901234567890123456789", "999999999999999999999999999999"];
    for (const [index, value] of values.entries()) {
      await page.locator("#market-units").fill(value);
      expect(await page.locator("#market-units").inputValue()).toBe(value);
      await review.click();
      const amount = `${value} ${lang === "ko" ? "모의 단위" : "mock units"}`;
      expect(await page.locator(".market-review p").nth(2).innerText()).toBe(amount);
      expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(index);
      await confirm.click(); await page.locator('[data-market-outcome="CONFIRMED"]').waitFor();
      const probe = await page.evaluate(() => window.__kixResaleFault!);
      const request = { kind, productId: "demo-001", variantId: "standard", expectedVersion: index, mockUnits: value };
      expect(probe.dispatches).toBe(index + 1); expect(probe.requests?.[index]).toEqual(request);
      expect(probe.results?.[index]).toMatchObject({ kind: "CONFIRMED", request, record: { side: kind, mockUnits: value, state: "open" }, source: "synthetic", unit: "mock-unit", fundsExecuted: false, economicFinalityClaimed: false, productionEndpoint: false, protocolTruth: false, productionConformance: false });
      expect(await page.locator("#market-offers-rows li").nth(index).innerText()).toContain(amount);
      expect(await page.locator("#market-units").inputValue()).toBe(value);
    }
    await suite.quiet(page, "exact synthetic unit strings"); await page.close();
  });

  it("retains invalid bulk input and the typed 31st digit without dispatch or truncation", async () => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixResaleFault = { mode: "normal", dispatches: 0 }; });
    await page.goto(suite.faultOrigin + "/resale/market/demo-001");
    await page.locator("#market-action").selectOption("bid");
    const input = page.locator("#market-units");
    expect(await input.getAttribute("maxlength")).toBeNull();
    for (const value of ["00", "01", "+1", "-1", "1.0", "1e3", "1,000", "1_000", "1 000", " 0", "0 ", "１", "9".repeat(31), "9".repeat(100)]) {
      await input.fill(""); await input.focus(); await page.keyboard.insertText(value);
      await page.getByRole("button", { name: "Review simulation" }).click();
      expect(await input.inputValue()).toBe(value);
      expect(await input.getAttribute("aria-invalid")).toBe("true");
      expect(await page.locator(".market-review").count()).toBe(0);
      expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
      expect(await page.locator("#market-offers-rows li").count()).toBe(0);
    }
    await input.fill("9".repeat(30)); await input.press("End"); await input.pressSequentially("9");
    expect(await input.inputValue()).toBe("9".repeat(31));
    await input.press("Enter"); await page.locator(".error-summary:focus").waitFor();
    expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
    await suite.quiet(page, "untruncated invalid amounts"); await page.close();
  });

  it("blocks a reviewed long offer offline and never replays it on reconnect", async () => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixResaleFault = { mode: "normal", dispatches: 0 }; });
    await page.goto(suite.faultOrigin + "/resale/market/demo-001");
    await page.locator("#market-action").selectOption("ask");
    await page.locator("#market-units").fill("999999999999999999999999999999");
    await page.getByRole("button", { name: "Review simulation" }).click();
    await suite.session().context.setOffline(true); await page.locator('[data-connectivity-state="offline"]').waitFor();
    const confirm = page.getByRole("button", { name: /^Record simulation once/ });
    await confirm.focus(); await page.keyboard.press("Enter"); await page.keyboard.press("Space");
    expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
    await suite.session().context.setOffline(false); await page.locator('[data-connectivity-state="local"]').waitFor();
    expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
    await confirm.focus(); await page.keyboard.press("Enter");
    expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
    await page.getByRole("button", { name: "Read current fixtures" }).click();
    expect(await page.locator("#market-units").inputValue()).toBe("999999999999999999999999999999");
    expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
    await suite.quiet(page, "offline long offer without replay"); await page.close();
  });
  it.each(["reject", "lost", "held"] as const)("keeps the existing %s guard with a 30-digit offer", async mode => {
    const page = await suite.newPage();
    await page.addInitScript(mode => { window.__kixResaleFault = { mode, dispatches: 0 }; }, mode);
    await page.goto(suite.faultOrigin + "/resale/market/demo-001");
    await page.locator("#market-action").selectOption("bid");
    const value = "999999999999999999999999999999";
    await page.locator("#market-units").fill(value);
    await page.getByRole("button", { name: "Review simulation" }).click();
    await page.getByRole("button", { name: "Record simulation once" }).focus();
    await page.keyboard.press("Enter"); await page.keyboard.press("Enter"); await page.keyboard.press("Space");
    expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(1);
    expect(await page.evaluate(() => window.__kixResaleFault?.requests?.[0])).toMatchObject({ kind: "bid", mockUnits: value });
    if (mode === "held") {
      await page.locator('[data-market-outcome="IN_FLIGHT"]').waitFor();
      await poll(() => page.evaluate(() => typeof window.__kixResaleFault?.release), type => type === "function", "held response");
      await page.evaluate(() => window.__kixResaleFault?.release?.());
      await page.locator('[data-market-outcome="CONFIRMED"]').waitFor();
      expect(await page.locator("#market-offers-rows").innerText()).toContain(value);
    } else {
      await page.locator(`[data-market-outcome="${mode === "lost" ? "UNKNOWN" : "REJECTED"}"]`).waitFor();
      expect(await page.getByRole("button", { name: "Review simulation" }).isDisabled()).toBe(true);
      if (mode === "reject") expect(await page.locator("#market-outcome").innerText()).toContain("STALE_VERSION");
      else {
        await suite.session().context.setOffline(true); await page.locator('[data-connectivity-state="offline"]').waitFor();
        await suite.session().context.setOffline(false); await page.locator('[data-connectivity-state="local"]').waitFor();
        await page.getByRole("button", { name: "Read current fixtures" }).click();
        await page.getByRole("link", { name: "Resale market", exact: true }).last().click();
        await page.locator(".market-card").first().click();
        await page.locator('[data-market-outcome="UNKNOWN"]').waitFor();
        expect(await page.getByRole("button", { name: "Review simulation" }).isDisabled()).toBe(true);
      }
    }
    expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(1);
    await suite.quiet(page, "long offer guard"); await page.close();
  });
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
  it.each(["confirmed", "reject", "lost"] as const)("isolates %s after real cross-product navigation", async mode => {
    const page = mode === "confirmed" ? await newDeskPage(suite.newPage, suite.origin) : await suite.newPage();
    if (mode !== "confirmed") await page.addInitScript(mode => { window.__kixResaleFault = { mode, dispatches: 0 }; }, mode);
    const origin = mode === "confirmed" ? suite.origin : suite.faultOrigin;
    await page.goto(origin + "/resale/market/demo-001");
    await page.getByRole("button", { name: "Review simulation" }).click();
    await page.getByRole("button", { name: "Record simulation once" }).click();
    await page.locator(`[data-market-outcome="${mode === "confirmed" ? "CONFIRMED" : mode === "reject" ? "REJECTED" : "UNKNOWN"}"]`).waitFor();
    await page.getByRole("link", { name: "Resale market", exact: true }).last().click();
    await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Fold object" }) }).click();
    await page.getByLabel("Action", { exact: true }).waitFor();
    expect(await page.locator("#market-outcome").getAttribute("data-market-outcome")).toBe(mode === "lost" ? "UNKNOWN" : "");
    expect(await page.getByRole("button", { name: "Review simulation" }).isDisabled()).toBe(mode === "lost");
    if (mode === "lost") {
      await page.getByRole("button", { name: "Read current fixtures" }).click();
      expect(await page.locator("#market-outcome").innerText()).toContain("UNKNOWN");
      expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(1);
    } else {
      await page.getByRole("button", { name: "Review simulation" }).click();
      await page.getByRole("heading", { name: "Review simulation" }).waitFor();
      if (mode === "reject") expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(1);
    }
    await suite.quiet(page, "cross-product outcome isolation"); await page.close();
  });
  it("bounds large independent history pages, retains snapshot positions and fences UNKNOWN", async () => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixResaleFault = { mode: "lost", dispatches: 0, history: { count: 1001, wideCount: 51 } }; });
    await page.goto(suite.faultOrigin + "/resale/market/demo-001?lang=en&q=object&page=2");
    await page.locator("#market-trades-rows tr").first().waitFor();
    const initialUrl = page.url();
    const initialReads = await page.evaluate(() => window.__kixResaleFault?.reads);
    for (const section of ["trades", "offers"]) {
      const nav = page.locator(`nav[aria-describedby="market-${section}-status"]`);
      const rows = page.locator(`#market-${section}-rows > *`);
      const seen: string[] = [];
      for (let index = 0; index < 21; index++) {
        expect(await rows.count()).toBe(index === 20 ? 1 : 50);
        seen.push(...await rows.evaluateAll((nodes, attr) => nodes.map(n => n.getAttribute(attr)!), section === "trades" ? "data-trade-id" : "data-offer-id"));
        if (index < 20) await nav.getByRole("button", { name: "Next page", exact: true }).click();
      }
      expect(seen).toEqual(Array.from({ length: 1001 }, (_, i) => `${section === "trades" ? "trade" : "offer"}-0-standard-${i}`));
      await nav.getByRole("button", { name: "First page", exact: true }).click();
    }
    expect(page.url()).toBe(initialUrl);
    expect(await page.evaluate(() => window.__kixResaleFault?.reads)).toBe(initialReads);
    expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
    const trades = page.locator('nav[aria-describedby="market-trades-status"]');
    const offers = page.locator('nav[aria-describedby="market-offers-status"]');
    await trades.getByRole("button", { name: "Last page" }).click();
    await offers.getByRole("button", { name: "Next page" }).click();
    const refresh = page.getByRole("button", { name: "Read current fixtures" });
    for (const [count, range] of [[1051, "1001–1050 of 1051; page 21 of 22"], [51, "51–51 of 51; page 2 of 2"], [1001, "51–100 of 1001; page 2 of 21"], [0, "0–0 of 0; page 0 of 0"], [1001, "1–50 of 1001; page 1 of 21"]] as const) {
      await page.evaluate(count => { window.__kixResaleFault!.history!.count = count; }, count);
      await refresh.click();
      await poll(() => page.locator("#market-trades-status").innerText(), text => text.includes(range), "accepted history refresh");
    }
    await page.getByLabel("Variant", { exact: true }).selectOption("wide");
    expect(await page.locator("#market-offers-status").innerText()).toContain("Wide: 1–50 of 51");
    await page.getByLabel("Variant", { exact: true }).selectOption("standard");
    await page.getByRole("button", { name: "Review simulation" }).click();
    await page.getByRole("button", { name: "Record simulation once" }).click();
    await page.locator('[data-market-outcome="UNKNOWN"]').waitFor();
    const fencedReads = await page.evaluate(() => window.__kixResaleFault?.reads);
    await trades.getByRole("button", { name: "Last page" }).click();
    await offers.getByRole("button", { name: "Last page" }).click();
    expect(await page.evaluate(() => window.__kixResaleFault?.reads)).toBe(fencedReads);
    await refresh.click();
    await page.locator('[data-locale="ko"]').click();
    expect(await page.locator("#market-trades-status").innerText()).toContain("체결 내역 · 기본");
    expect(await page.locator("#market-outcome").innerText()).toContain("UNKNOWN");
    expect(await page.getByRole("button", { name: "모의 거래 검토" }).isDisabled()).toBe(true);
    expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(1);
    await suite.quiet(page, "bounded history pages, snapshot changes and UNKNOWN"); await page.close();
  });

});
