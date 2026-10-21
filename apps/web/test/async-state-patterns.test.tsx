import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { COMMERCE_COMMAND_BINDINGS } from "@kix/protocol-adapter";
import { ASYNC_STATES, AsyncState, type AsyncStateProps } from "../src/components/AsyncState";
import { LocaleContext, stateFor } from "../src/i18n/locale-context";

function html(props: AsyncStateProps, locale: "en" | "ko" = "en") {
  return renderToStaticMarkup(<MemoryRouter><LocaleContext value={stateFor(locale, () => {})}><AsyncState {...props} /></LocaleContext></MemoryRouter>);
}

describe("shared async presentation contract", () => {
  for (const kind of ASYNC_STATES) {
    it(`${kind} has its own word, live ownership and busy state in both locales`, () => {
      for (const locale of ["en", "ko"] as const) {
        const markup = html({ kind, label: "Synthetic" }, locale);
        expect(markup).toContain(`data-async-state="${kind}"`);
        expect(markup).toContain(`role="${kind === "error" ? "alert" : "status"}"`);
        expect(markup).toContain(`aria-live="${kind === "error" ? "assertive" : "polite"}"`);
        expect(markup).toContain(`aria-busy="${kind === "loading"}"`);
        expect(markup).not.toMatch(/성공|완료|승인/);
      }
    });
  }

  it("error always has help; only a supplied read action offers a non-submitting button", () => {
    expect(html({ kind: "error", label: "Read" })).toContain('href="/help"');
    expect(html({ kind: "error", label: "Read" })).not.toContain("<button");
    const onRead = vi.fn();
    const markup = html({ kind: "error", label: "Read", read: { label: "Read once", onRead } });
    expect(markup).toContain('<button type="button">Read once</button>');
    expect(onRead).not.toHaveBeenCalled();
    expect(markup).not.toContain("Nothing was sent");
  });

  it("UNKNOWN never offers recovery and STALE does not resolve it", () => {
    const read = { label: "Read once", onRead: vi.fn() };
    const unknown = html({ kind: "unknown", label: "Write", read });
    expect(unknown).toContain("may have applied");
    expect(unknown).toContain('href="/receipts"');
    expect(unknown).not.toContain("<button");
    expect(unknown).not.toMatch(/success|failed|completed|role="alert"/);
    expect(html({ kind: "stale", label: "Read", read })).toContain("does not resolve an UNKNOWN");
  });

  it("a parent live owner prevents nested announcements and preserves caller ids", () => {
    const markup = html({ kind: "unknown", label: "Write", announcement: "parent", id: "focus-target", tabIndex: -1 });
    expect(markup).toContain('id="focus-target"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).not.toContain("role=");
    expect(markup).not.toContain("aria-live=");
  });

  it("prints only safe codes and preserves nullable consideredAction from the locked records", () => {
    expect(html({ kind: "error", label: "Read", code: "READ_FAULT" })).toContain("READ_FAULT");
    expect(html({ kind: "error", label: "Read", code: "unsafe <value>" })).not.toContain("unsafe");
    for (const method of ["placeHold", "listPerformances"] as const) {
      const record = COMMERCE_COMMAND_BINDINGS[method];
      const markup = html({ kind: "not-bound", label: "Desk", binding: { method, record } });
      expect(markup).toContain(`consideredAction ${record.consideredAction ?? "none"}`);
      expect(markup).toContain(record.reason.replaceAll("&", "&amp;").replaceAll('"', "&quot;"));
      expect(markup).not.toContain("<button");
    }
  });
});
