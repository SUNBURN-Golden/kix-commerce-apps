import { selectShellProtocol as createProtocol, type CommerceProtocol } from "../../../packages/protocol-adapter/src/shell-entry";
import { connectivity } from "./connectivity/store";

const mode = import.meta.env.VITE_KIX_PROTOCOL_MODE || "stub";
const baseUrl = import.meta.env.VITE_KIX_PROTOCOL_API_BASE;

const selected = createProtocol({ mode, baseUrl });
connectivity.configure(selected.environment);
export let protocol: CommerceProtocol;
let ready: Promise<void> | null = null;
if (selected.ready === null) {
  protocol = selected.protocol;
} else {
  ready = selected.ready.then((verified) => { protocol = verified; });
}
export const protocolReady = ready;
