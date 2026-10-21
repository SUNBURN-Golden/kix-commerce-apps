/**
 * Test-only wrapper of the protocol port, swapped in by buildShellFaultApp. While window.__kixShellFault is
 * "app" its describe() throws, which makes the shell itself fail to render. Everything else is the real port.
 */
import { protocol as real } from "../../web/src/protocol";

// Several desks read describe() while the module graph loads, and nothing can catch an error there. The wrapper
// arms itself in a microtask, after the graph is evaluated and before React renders, so the throw lands in the
// shell render, which is what the app boundary covers.
let armed = false;
queueMicrotask(() => {
  armed = true;
});

export const protocol = new Proxy(real, {
  get(target, key, receiver) {
    if (key === "describe" && armed && (window as unknown as { __kixShellFault?: string }).__kixShellFault === "app") {
      return () => {
        throw new Error("Bearer sk_live_FAKE0123456789abcdef shell describe failed");
      };
    }
    if (key === "placeHold") {
      return async (input: Parameters<typeof real.placeHold>[0]) => {
        const probe = (window as unknown as { __kixFormDeferred?: { attempts: number; release?: () => void } }).__kixFormDeferred;
        if (probe) {
          probe.attempts += 1;
          await new Promise<void>((resolve) => { probe.release = resolve; });
        }
        return real.placeHold(input);
      };
    }
    if (key === "listPerformances") {
      const fixture = window as unknown as {
        __kixAsyncReadMode?: "held" | "error" | "empty" | "normal";
        __kixAsyncReads?: number;
        __kixAsyncReleaseRead?: () => void;
      };
      if (fixture.__kixAsyncReadMode) {
        return () => {
          fixture.__kixAsyncReads = (fixture.__kixAsyncReads ?? 0) + 1;
          if (fixture.__kixAsyncReadMode === "held") {
            return new Promise((_resolve, reject) => {
              fixture.__kixAsyncReleaseRead = () => reject(new Error("Synthetic catalogue read fault"));
            });
          }
          if (fixture.__kixAsyncReadMode === "error") return Promise.reject(new Error("Synthetic catalogue read fault"));
          if (fixture.__kixAsyncReadMode === "empty") return Promise.resolve([]);
          return target.listPerformances();
        };
      }
    }
    const value = Reflect.get(target, key, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
