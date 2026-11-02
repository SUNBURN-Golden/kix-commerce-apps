/** Page-load observers for a route departure, independent of lazy-screen cleanup timing. No desk imports. */
const listeners = new Set<() => void>();
let current: string | null = null;
export function observeNavigation(pathname: string): void {
  if (pathname === current) return;
  current = pathname;
  listeners.forEach(listener => listener());
}
export function onNavigation(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
