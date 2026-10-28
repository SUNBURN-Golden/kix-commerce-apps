/** Test-build-only send-boundary probes; product invokers and receipts stay unchanged. */
import { giftSource as gift } from "../../web/src/gift-source";
import { organizerSource as organizer } from "../../web/src/organizer-source";
import type { LocalCallInvoker } from "@kix/protocol-adapter";

function wrap<T extends { invoker: LocalCallInvoker }>(source: T | null): T | null {
  if (!source) return null;
  return { ...source, invoker: { async invokeLocalCall(input) {
    const probe = window.__kixIme;
    if (probe) {
      probe.attempts += 1;
      if (probe.mode === "held") await new Promise<void>((resolve) => { probe.release = resolve; });
      if (probe.mode === "unknown") throw new Error("Synthetic response lost");
    }
    return source.invoker.invokeLocalCall(input);
  } } };
}
export const giftSource = wrap(gift);
export const organizerSource = wrap(organizer);
