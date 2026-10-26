// The explicit extension keeps readiness independent of the shell fault fixture's protocol port.
import { protocolReady } from "./protocol.js";

export function renderWhenReady(render: () => void): Promise<void> | null {
  if (protocolReady !== null) return protocolReady.then(render);
  render();
  return null;
}
