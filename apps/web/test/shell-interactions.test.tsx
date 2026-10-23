// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { focusPrimaryHeading, onScreenReady, useRouteFocus } from "../src/shell/route-focus";
import { useRestoreFocus } from "../src/a11y/focus";
import { motionReduced, REDUCED_MOTION_QUERY } from "../src/a11y/motion";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { LocaleSwitch } from "../src/i18n/LocaleSwitch";
import { button, click, dispatch, element, renderDom } from "./support/render-dom";

function FocusFixture({ route, loading = false, error = null }: { route: string; loading?: boolean; error?: string | null }) {
  useRouteFocus(route);
  useRestoreFocus(error, "typed-value");
  return <><a href="#desk-main">Skip</a><main id="desk-main" tabIndex={-1}>{loading ? <p>Loading</p> : <h2>{route}</h2>}<input id="typed-value" defaultValue="keep input" /></main></>;
}

describe("mounted shell effects", () => {
  it("preserves initial focus, moves on navigation, and removes temporary tabindex on blur", async () => {
    const view = await renderDom(<FocusFixture route="one" />);
    expect(document.activeElement).toBe(document.body);
    await view.rerender(<FocusFixture route="two" />);
    const heading = element(view.container, "h2");
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute("tabindex")).toBe("-1");
    element(view.container, "input").focus();
    expect(heading.hasAttribute("tabindex")).toBe(false);
    await view.rerender(<FocusFixture route="three" />);
    expect(document.activeElement?.id).toBe("typed-value");
    await view.rerender(<FocusFixture route="three" error="refused" />);
    expect(document.activeElement?.id).toBe("typed-value");
    expect(element<HTMLInputElement>(view.container, "input").value).toBe("keep input");
  });

  it("finishes delayed navigation while respecting focus moved into the page", async () => {
    const view = await renderDom(<FocusFixture route="one" />);
    await view.rerender(<FocusFixture route="two" loading />);
    await view.rerender(<FocusFixture route="two" />);
    onScreenReady();
    expect(document.activeElement).toBe(element(view.container, "h2"));
    element(view.container, "a").focus();
    await view.rerender(<FocusFixture route="three" loading />);
    await view.rerender(<FocusFixture route="three" />);
    element(view.container, "input").focus();
    onScreenReady();
    expect(document.activeElement?.id).toBe("typed-value");
    await view.unmount();
    expect(focusPrimaryHeading()).toBe(false);
  });

  it("focuses main when no heading exists and preserves an explicit heading tabindex", async () => {
    const view = await renderDom(<main id="desk-main" tabIndex={-1}><p>Empty</p></main>);
    expect(focusPrimaryHeading()).toBe(true);
    expect(document.activeElement?.id).toBe("desk-main");
    await view.rerender(<main id="desk-main"><h2 tabIndex={-1}>Page</h2></main>);
    focusPrimaryHeading();
    await dispatch(element(view.container, "h2"), new FocusEvent("blur"));
    expect(element(view.container, "h2").tabIndex).toBe(-1);
  });

  it("switches locale and document language without modifying journal evidence", async () => {
    sessionStorage.setItem("kix-session-journal", "evidence sentinel");
    const view = await renderDom(<LocaleProvider><LocaleSwitch /></LocaleProvider>);
    expect(element(view.container, '[role="status"]').textContent).toBe("");
    const korean = element<HTMLButtonElement>(view.container, '[data-locale="ko"]');
    korean.focus();
    await click(korean);
    expect(document.documentElement.lang).toBe("ko");
    expect(sessionStorage.getItem("kix-locale")).toBe("ko");
    expect(document.activeElement).toBe(korean);
    const announcement = element(view.container, '[role="status"]').textContent;
    expect(announcement).not.toBe("");
    await click(korean);
    expect(element(view.container, '[role="status"]').textContent).toBe(announcement);
    await click(button(view.container, "English"));
    expect(document.documentElement.lang).toBe("en");
    expect(sessionStorage.getItem("kix-session-journal")).toBe("evidence sentinel");
  });

  it("reads the reduced-motion media preference and tolerates its absence", () => {
    expect(motionReduced()).toBe(false);
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal("matchMedia", matchMedia);
    expect(motionReduced()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
  });
});
