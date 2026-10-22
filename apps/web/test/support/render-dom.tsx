import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, vi } from "vitest";

const mounts: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const unmount of mounts.splice(0).reverse()) await unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  document.documentElement.lang = "en";
});

/** Mount real components and flush their effects and synthetic promise responses. */
export async function renderDom(node: ReactNode) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // Any accidental network call fails the test, including a caught request.
  const network = vi.fn(() => { throw new Error("Network forbidden in DOM fixtures"); });
  vi.stubGlobal("fetch", network);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let mounted = true;
  const unmount = async () => {
    if (!mounted) return;
    mounted = false;
    await act(async () => root.unmount());
    container.remove();
    expect(network).not.toHaveBeenCalled();
  };
  mounts.push(unmount);
  const rerender = async (next: ReactNode) => { await act(async () => root.render(next)); };
  await rerender(node);
  return { container, rerender, unmount };
}

export function element<T extends Element = HTMLElement>(container: ParentNode, selector: string): T {
  const found = container.querySelector<T>(selector);
  if (!found) throw new Error(`Missing element: ${selector}`);
  return found;
}

export function button(container: ParentNode, label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

export async function click(node: HTMLElement) {
  await act(async () => node.click());
}

export async function change(node: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    // Use the native setter so React's value tracker observes an actual user change.
    const prototype = node instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event(node instanceof HTMLInputElement ? "input" : "change", { bubbles: true }));
  });
}

export async function dispatch(node: Element | Window | Document, event: Event) {
  await act(async () => { node.dispatchEvent(event); });
}
