import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SafeText, visibleSafeText } from "../src/safe-text";
import { HOSTILE_FIXTURES } from "./support/hostile-fixtures";

describe("SafeText", () => {
  it("renders markup and javascript-looking values only as escaped text", () => {
    for (const value of [HOSTILE_FIXTURES.html, HOSTILE_FIXTURES.javascriptUrl, HOSTILE_FIXTURES.emoji]) {
      const html = renderToStaticMarkup(<SafeText value={value} />);
      expect(html).not.toContain("<img src=x");
      expect(html).not.toContain("href=\"javascript:");
      expect(html).not.toContain("script>");
      expect(html).toContain(value === HOSTILE_FIXTURES.html ? "&lt;img" : value);
    }
  });

  it("truncates long display text but leaves the original selectable in details", () => {
    const html = renderToStaticMarkup(<SafeText value={HOSTILE_FIXTURES.long} maxDisplay={20} />);
    expect(html).toContain(`${"L".repeat(20)}…`);
    expect(html).toContain(`<pre>${HOSTILE_FIXTURES.long}</pre>`);
    expect(html).toContain("Copyable original");
  });

  it("makes bidi and control characters visible while preserving the original", () => {
    for (const value of [HOSTILE_FIXTURES.bidi, HOSTILE_FIXTURES.controls]) {
      const safe = visibleSafeText(value);
      expect(safe.display).toContain("�");
      expect(safe.original).toBe(value);
      expect(renderToStaticMarkup(<SafeText value={value} />)).toContain("<details");
    }
  });
});
