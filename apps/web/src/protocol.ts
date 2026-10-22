import { createProtocol, type CommerceProtocol } from "@kix/protocol-adapter";
import { connectivity } from "./connectivity/store";

const mode = import.meta.env.VITE_KIX_PROTOCOL_MODE || "stub";
const baseUrl = import.meta.env.VITE_KIX_PROTOCOL_API_BASE;

const selected = createProtocol({ mode, baseUrl });
connectivity.configure(selected.describe().environment);
export const protocol: CommerceProtocol = selected;
