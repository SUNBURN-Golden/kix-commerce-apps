/** Test-only app-import seam. The canonical adapter module is shared with the app.
 * Inert unless a browser test installs __kixReadFault; no product build imports this.
 */
import {
  discoveryReadPortFor as discoveryFactory,
  inventoryReadPortFor as inventoryFactory,
} from "../../../packages/protocol-adapter/src/index";

type Fault = {
  method: "readPage" | "readRow" | "readSummary" | "readSelection";
  mode: "throw" | "reject" | "held" | "normal";
  calls: number;
  release?: () => void;
};

function wrap<T extends object>(port: T): T {
  return new Proxy(port, {
    get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const fault = (window as unknown as { __kixReadFault?: Fault }).__kixReadFault;
        if (fault && key === fault.method) {
          fault.calls += 1;
          if (fault.mode === "throw") throw new Error("Synthetic read fault (private payload)");
          if (fault.mode === "reject") return Promise.reject(new Error("Synthetic read fault (private payload)"));
          if (fault.mode === "held") return new Promise((_resolve, reject) => {
            fault.release = () => reject(new Error("Synthetic held read fault"));
          });
        }
        return Reflect.apply(value, target, args);
      };
    },
  });
}

export const discoveryReadPortFor: typeof discoveryFactory = (...args) => wrap(discoveryFactory(...args));
export const inventoryReadPortFor: typeof inventoryFactory = (...args) => wrap(inventoryFactory(...args));
