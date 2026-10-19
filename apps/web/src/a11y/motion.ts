/**
 * The desk owns no animation and no transition. The one timed update is the
 * integration-http transport re-probe in the Shell. A reduced-motion
 * preference is the user's stop control for it: the probe still runs once on
 * load, and no timer is started while the preference is set. Stub mode never
 * polls, and a hidden tab already pauses the timed probe.
 */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(match: (query: string) => boolean): boolean {
  return match(REDUCED_MOTION_QUERY);
}

/** SSR-safe read of the current preference. Defaults to "not reduced" off-browser. */
export function motionReduced(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return prefersReducedMotion((query) => window.matchMedia(query).matches);
}
