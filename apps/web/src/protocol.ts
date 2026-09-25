import { createProtocol, type CommerceProtocol } from "@kix/protocol-adapter";

const mode = import.meta.env.VITE_KIX_PROTOCOL_MODE || "stub";
const baseUrl = import.meta.env.VITE_KIX_PROTOCOL_API_BASE;

export const protocol: CommerceProtocol = createProtocol({ mode, baseUrl });
