import { useEffect, useRef } from "react";

/**
 * Moves focus to the first heading in the main region, or to the region itself.
 * The heading gets a temporary tabindex so it can take focus, and loses it on blur.
 * Pages use h2 for their title under the constant shell h1, so the first h1 or h2 inside main is the page title.
 */
export function focusPrimaryHeading(): boolean {
  const main = document.getElementById("desk-main");
  if (!main) {
    return false;
  }
  const heading = main.querySelector<HTMLElement>("h1, h2");
  const target = heading ?? main;
  if (heading && !heading.hasAttribute("tabindex")) {
    heading.setAttribute("tabindex", "-1");
    heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
  }
  target.focus({ preventScroll: false });
  return document.activeElement === target;
}

/**
 * Focuses the page heading when the page key changes after the first render.
 * First paint keeps the skip link first in the Tab order. A page that already put focus inside main keeps it.
 */
export function useRouteFocus(key: string): void {
  const previous = useRef(key);
  useEffect(() => {
    if (previous.current === key) {
      return;
    }
    previous.current = key;
    const main = document.getElementById("desk-main");
    const active = document.activeElement;
    if (main && active && active !== main && main.contains(active)) {
      return;
    }
    focusPrimaryHeading();
  }, [key]);
}
