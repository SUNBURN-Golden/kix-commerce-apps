// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DiagnosticsView } from "../src/pages/Diagnostics";
import { ReceiptScreen } from "../src/pages/Receipts";
import { buildDiagnostics } from "../src/diagnostics/model";
import { createConnectivityStore } from "../src/connectivity/store";
import { protocol } from "../src/connectivity/desk-protocol";
import { journeySource } from "../src/journey-source";
import { giftSource } from "../src/gift-source";
import { consentSource } from "../src/consent-source";
import { organizerSource } from "../src/organizer-source";
import { LocaleContext, stateFor } from "../src/i18n/locale-context";
import type { Locale } from "../src/i18n/locales";
import { messages as diagnosticCopy } from "../src/i18n/messages/pages--Diagnostics";
import { messages as receiptCopy } from "../src/i18n/messages/pages--Receipts";
import { paginationModel } from "./support/receipt-pagination-fixture";
import { button, change, click, element, renderDom } from "./support/render-dom";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, finish: async (success = true) => {
    await act(async () => { if (success) resolve(); else reject(new Error("private clipboard exception")); });
  } };
}
const screens = ["receipts", "diagnostics"] as const;

function fixture(screen: typeof screens[number], version = 0, locale: Locale = "en") {
  const model = screen === "receipts" ? paginationModel("buyer", 60 + version) : buildDiagnostics({
    mode: "stub", locale: "en", display: { colorScheme: "not-read", forcedColors: "not-read", reducedMotion: "not-read" },
    connectivity: { ...createConnectivityStore("stub", true).getSnapshot(), epoch: version },
    journal: { kind: "empty" }, liveJournal: null, outcomes: [], omittedOutcomeCount: 0,
  });
  const node = <StrictMode><LocaleContext.Provider value={stateFor(locale, () => {})}><MemoryRouter>
    {"sessionId" in model ? <ReceiptScreen model={model} role={model.role} onRole={() => {}} /> :
      <DiagnosticsView model={model} />}
  </MemoryRouter></LocaleContext.Provider></StrictMode>;
  return { node, model, snapshot: JSON.stringify(model), text: model.exportText };
}

for (const screen of screens) describe(`${screen} copy ownership`, () => {
  const textareaSelector = screen === "receipts" ? "#receipt-diagnostic" : "#diagnostics-export";
  const copySelector = screen === "receipts" ? "#receipt-export button" : "#diagnostics-copy";
  const statusSelector = screen === "receipts" ? "#receipt-copy-feedback" : "[data-page=diagnostics] .receipt-export [role=status]";
  const copyText = (locale: Locale, state: "idle" | "selected" | "copied") => screen === "receipts"
    ? receiptCopy[locale][state === "idle" ? "e.34" : state === "selected" ? "e.35" : "e.36"]
    : diagnosticCopy[locale][`diag.${state}`];
  const status = (container: HTMLElement) => element(container, statusSelector).textContent;
  const activate = (container: HTMLElement) => click(element(container, copySelector));

  for (const locale of ["en", "ko"] as const) it.each(["success", "absent", "non-function", "getter", "method-getter", "throw", "reject"])(
    `${locale}: %s preserves exact bytes, selection and evidence without side effects`, async (mode) => {
      const pending = deferred();
      const clipboard = { writeText: vi.fn(function (this: unknown, text: string) {
        expect(this).toBe(clipboard); expect(text).toBe(value.text);
        if (mode === "throw") throw Error("private clipboard exception");
        return pending.promise;
      }) };
      const nav = { clipboard: mode === "absent" ? undefined : mode === "non-function" ? { writeText: true } : clipboard };
      if (mode === "getter") Object.defineProperty(nav, "clipboard", { get() { throw Error("private getter"); } });
      if (mode === "method-getter") Object.defineProperty(clipboard, "writeText", { get() { throw Error("private method getter"); } });
      vi.stubGlobal("navigator", nav);
      const value = fixture(screen, 0, locale);
      const dom = await renderDom(value.node);
      const mutations = ["setItem", "removeItem", "clear"].map((method) => vi.spyOn(Storage.prototype, method as "setItem"));
      const invocations = [journeySource, giftSource, consentSource, organizerSource].map((source) =>
        vi.spyOn(source!.invoker, "invokeLocalCall"));
      const list = vi.spyOn(protocol, "listPerformances");
      await activate(dom.container);
      const area = element<HTMLTextAreaElement>(dom.container, textareaSelector);
      expect(document.activeElement).toBe(area);
      expect([area.selectionStart, area.selectionEnd]).toEqual([0, value.text.length]);
      expect(status(dom.container)).toBe(copyText(locale, "selected"));
      if (mode === "success" || mode === "reject") await pending.finish(mode === "success");
      expect(status(dom.container)).toBe(copyText(locale, mode === "success" ? "copied" : "selected"));
      if (mode !== "method-getter") expect(clipboard.writeText).toHaveBeenCalledTimes(["success", "throw", "reject"].includes(mode) ? 1 : 0);
      expect(area.value).toBe(value.text);
      expect(JSON.stringify(value.model)).toBe(value.snapshot);
      for (const mutation of mutations) expect(mutation).not.toHaveBeenCalled();
      for (const invoke of invocations) expect(invoke).not.toHaveBeenCalled();
      expect(list).not.toHaveBeenCalled();
      expect(dom.container.textContent).not.toContain("private");
    },
  );

  for (const latestFirst of [false, true]) for (const latestSuccess of [false, true]) {
    it(`overlapping writes: latest first=${latestFirst}, latest succeeds=${latestSuccess}`, async () => {
      const first = deferred(), last = deferred();
      const writeText = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      const value = fixture(screen);
      const dom = await renderDom(value.node);
      await activate(dom.container); await activate(dom.container);
      const control = element<HTMLElement>(dom.container, copySelector);
      control.focus();
      if (latestFirst) {
        await last.finish(latestSuccess); await first.finish(!latestSuccess);
      } else {
        await first.finish(!latestSuccess);
        expect(status(dom.container)).toBe(copyText("en", "selected"));
        await last.finish(latestSuccess);
      }
      expect(status(dom.container)).toBe(copyText("en", latestSuccess ? "copied" : "selected"));
      expect(document.activeElement).toBe(control);
      expect(writeText.mock.calls).toEqual([[value.text], [value.text]]);
    });
  }

  for (const settled of [false, true]) for (const returnToA of [false, true]) {
    it(`export A -> B${returnToA ? " -> A" : ""}, already copied=${settled}`, async () => {
      const pending = deferred();
      const writeText = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      const a = fixture(screen), b = fixture(screen, 1);
      const dom = await renderDom(a.node);
      await activate(dom.container);
      if (settled) await pending.finish();
      await dom.rerender(b.node);
      expect(status(dom.container)).toBe(copyText("en", "idle"));
      if (returnToA) await dom.rerender(a.node);
      if (!settled) await pending.finish();
      expect(status(dom.container)).toBe(copyText("en", "idle"));
      await activate(dom.container);
      expect(writeText).toHaveBeenLastCalledWith(returnToA ? a.text : b.text);
      expect(status(dom.container)).toBe(copyText("en", "copied"));
    });
  }

  it("changed export consumes stale rejection without stealing focus", async () => {
    const pending = deferred();
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => pending.promise) } });
    const dom = await renderDom(fixture(screen).node);
    await activate(dom.container);
    await dom.rerender(fixture(screen, 1).node);
    const control = element<HTMLElement>(dom.container, copySelector); control.focus();
    await pending.finish(false);
    expect(status(dom.container)).toBe(copyText("en", "idle"));
    expect(document.activeElement).toBe(control);
  });

  it("locale changes invalidate even identical export bytes", async () => {
    const pending = deferred();
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => pending.promise) } });
    const dom = await renderDom(fixture(screen).node);
    await activate(dom.container);
    await dom.rerender(fixture(screen, 0, "ko").node);
    await pending.finish();
    expect(status(dom.container)).toBe(copyText("ko", "idle"));
  });

  it.each([false, true])("unmount fences a late completion (success=%s) from a new mount", async (success) => {
    const pending = deferred();
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => pending.promise) } });
    const dom = await renderDom(fixture(screen).node);
    await activate(dom.container); await dom.unmount();
    const next = await renderDom(fixture(screen).node);
    const control = element<HTMLElement>(next.container, copySelector); control.focus();
    await pending.finish(success);
    expect(status(next.container)).toBe(copyText("en", "idle"));
    expect(document.activeElement).toBe(control);
  });

  it("equivalent models and presentation changes never reinsert or reannounce success", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const dom = await renderDom(fixture(screen).node);
    await activate(dom.container);
    const paragraph = element(dom.container, statusSelector);
    expect(paragraph.textContent).toBe(copyText("en", "copied"));
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((changes) => records.push(...changes));
    observer.observe(paragraph, { subtree: true, childList: true, characterData: true, attributes: true });
    try {
      for (let i = 0; i < 3; i++) await dom.rerender(fixture(screen).node);
      if (screen === "receipts") {
        await click(button(dom.container, "Next"));
        await click(element(dom.container, "button[data-entry-id]"));
        await change(element(dom.container, "#receipt-status-filter"), "unknown");
      }
      expect(element(dom.container, statusSelector)).toBe(paragraph);
      expect(paragraph.textContent).toBe(copyText("en", "copied"));
      expect(records).toEqual([]);
    } finally { observer.disconnect(); }
  });
});

it.each(["selected-role", "model-role", "session", "environment", "profile", "profileVersion", "domain"])(
  "receipt %s change fences pending feedback even with identical export text", async (field) => {
    const pending = deferred();
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => pending.promise) } });
    const model = paginationModel("buyer", 1);
    const changed = { ...model };
    if (field === "model-role") changed.role = "operator";
    else if (field === "session") changed.sessionId += "-other";
    else if (field === "environment") changed.environment = "integration-http";
    else if (field === "profile") changed.profile = "integration-gate";
    else if (field === "profileVersion" || field === "domain") changed[field] += "-other";
    const view = (next = model, selected = model.role) => <MemoryRouter><ReceiptScreen model={next} role={selected} onRole={() => {}} /></MemoryRouter>;
    const dom = await renderDom(view());
    await click(element(dom.container, "#receipt-export button"));
    await dom.rerender(view(changed, field === "selected-role" ? "operator" : model.role));
    await pending.finish();
    expect(element(dom.container, "#receipt-copy-feedback").textContent).toBe(receiptCopy.en["e.34"]);
    expect(element<HTMLTextAreaElement>(dom.container, "#receipt-diagnostic").value).toBe(model.exportText);
  },
);

it("diagnostics adapter mode changes invalidate identical export bytes", async () => {
  const pending = deferred();
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => pending.promise) } });
  const model = buildDiagnostics({ mode: "stub", locale: "en",
    display: { colorScheme: "not-read", forcedColors: "not-read", reducedMotion: "not-read" },
    connectivity: createConnectivityStore("stub", true).getSnapshot(),
    journal: { kind: "empty" }, liveJournal: null, outcomes: [], omittedOutcomeCount: 0 });
  const dom = await renderDom(<DiagnosticsView model={model} />);
  await click(element(dom.container, "#diagnostics-copy"));
  await dom.rerender(<DiagnosticsView model={{ ...model, view: { ...model.view, mode: "integration-http" } }} />);
  await pending.finish();
  expect(element(dom.container, ".receipt-export [role=status]").textContent).toBe(diagnosticCopy.en["diag.idle"]);
});
