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

/** True from a route change that found no page heading yet (the screen's code was still loading) until the screen is drawn. */
let headingPending = false;

/** Called by a screen slot after its screen is drawn. Finishes a focus move the route change could not make yet. */
export function onScreenReady(): void {
  if (!headingPending) {
    return;
  }
  headingPending = false;
  const main = document.getElementById("desk-main");
  const active = document.activeElement;
  if (main && active && active !== main && main.contains(active)) {
    return;
  }
  focusPrimaryHeading();
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
    if (main && !main.querySelector("h1, h2")) {
      // The screen's code is still loading: the slot finishes the move when the screen is drawn.
      headingPending = true;
      return;
    }
    headingPending = false;
    focusPrimaryHeading();
  }, [key]);
}
