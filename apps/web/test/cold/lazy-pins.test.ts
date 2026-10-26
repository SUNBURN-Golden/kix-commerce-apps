import { describe, expect, it, vi, afterEach } from "vitest";
import { selectShellProtocol, StubProtocolAdapter, ProtocolError } from "../../../../packages/protocol-adapter/src/shell-entry";

const adapter = "../../../../packages/protocol-adapter/src/";
const changed = (text: string) => {
  const bytes = Buffer.from(text, "utf8");
  let index = Math.floor(bytes.length / 2);
  while (bytes[index]! > 127) index += 1;
  bytes[index] = bytes[index]! ^ 1;
  return bytes.toString("utf8");
};

afterEach(() => { vi.unstubAllEnvs(); });

describe("cold shell selection and lazy verification", () => {
  it("starts the default stub synchronously and rejects unsupported modes", () => {
    const selected = selectShellProtocol();
    expect(selected.ready).toBeNull();
    expect(selected.protocol).toBeInstanceOf(StubProtocolAdapter);
    for (const mode of ["production", "public", "unknown"]) expect(() => selectShellProtocol({ mode })).toThrow(ProtocolError);
    expect(() => selectShellProtocol({ mode: "http" })).toThrow("KIX_PROTOCOL_API_BASE is required");
  });

  it("rejects a one-byte mutation in every one of the 15 inputs before HTTP construction or an exchange", async () => {
    const { verifyLazyPins } = await import("../../../../packages/protocol-adapter/src/http-entry");
    const { VENDORED_SDK_PIN_INPUTS, KIX_SDK_0_PIN } = await import("../../../../packages/protocol-adapter/src/sdk-pin");
    const { assertOpenApiContractRaw } = await import("../../../../packages/protocol-adapter/src/openapi-contract-pin");
    const { assertIntegrationGateRaw } = await import("../../../../packages/protocol-adapter/src/integration-gate-pin");
    expect(verifyLazyPins()).toBe(KIX_SDK_0_PIN);
    expect(Object.keys(VENDORED_SDK_PIN_INPUTS)).toHaveLength(15);
    const fetchImpl = vi.fn<typeof fetch>();
    for (const key of Object.keys(VENDORED_SDK_PIN_INPUTS) as (keyof typeof VENDORED_SDK_PIN_INPUTS)[]) {
      const pinInputs = { ...VENDORED_SDK_PIN_INPUTS, [key]: changed(VENDORED_SDK_PIN_INPUTS[key]) };
      expect(() => verifyLazyPins(pinInputs), key).toThrow(ProtocolError);
      const selected = selectShellProtocol({ mode: "http", baseUrl: "http://127.0.0.1:8765", fetchImpl, pinInputs });
      expect(selected.protocol).toBeNull();
      await expect(selected.ready, key).rejects.toThrow(ProtocolError);
    }
    expect(() => assertOpenApiContractRaw(changed(VENDORED_SDK_PIN_INPUTS.contractOnlyOpenApiRaw))).toThrow(ProtocolError);
    expect(() => assertIntegrationGateRaw(changed(VENDORED_SDK_PIN_INPUTS.integrationGateOpenApiRaw))).toThrow(ProtocolError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps the real HTTP adapter and sends nothing during successful selection", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const selected = selectShellProtocol({ mode: "http", baseUrl: "http://127.0.0.1:8765", fetchImpl });
    expect(selected.protocol).toBeNull();
    const protocol = await selected.ready;
    const { HttpProtocolAdapter } = await import("../../../../packages/protocol-adapter/src/http-adapter");
    expect(protocol).toBeInstanceOf(HttpProtocolAdapter);
    expect(protocol?.describe().environment).toBe("integration-http");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([false, true])("gates HTTP bootstrap rendering on verification (failure=%s)", async (fail) => {
    vi.resetModules();
    vi.stubEnv("VITE_KIX_PROTOCOL_MODE", "http");
    vi.stubEnv("VITE_KIX_PROTOCOL_API_BASE", "http://127.0.0.1:8765");
    const fetchImpl = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchImpl);
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const verification = vi.fn(async () => {
      await pending;
      const { createVerifiedHttpProtocol } = await vi.importActual<typeof import("../../../../packages/protocol-adapter/src/http-entry")>(adapter + "http-entry");
      const { VENDORED_SDK_PIN_INPUTS } = await import("../../../../packages/protocol-adapter/src/sdk-pin");
      return createVerifiedHttpProtocol({ baseUrl: "http://127.0.0.1:8765", fetchImpl,
        pinInputs: fail ? { ...VENDORED_SDK_PIN_INPUTS, clientRaw: changed(VENDORED_SDK_PIN_INPUTS.clientRaw) } : undefined });
    });
    vi.doMock("../../../../packages/protocol-adapter/src/http-entry", () => ({ createVerifiedHttpProtocol: verification }));
    try {
      const { renderWhenReady } = await import("../../src/bootstrap");
      const render = vi.fn();
      const ready = renderWhenReady(render);
      expect(ready).not.toBeNull();
      expect(render).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
      finish();
      if (fail) {
        await expect(ready).rejects.toThrow("SDK pin check failed");
        expect(render).not.toHaveBeenCalled();
      } else {
        await ready;
        expect(render).toHaveBeenCalledOnce();
        const { protocol } = await import("../../src/protocol");
        expect(protocol.describe().adapter).toBe("http");
      }
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("../../../../packages/protocol-adapter/src/http-entry");
      vi.unstubAllGlobals();
    }
  });

  it("renders synchronously through the default bootstrap", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_KIX_PROTOCOL_MODE", "stub");
    const { renderWhenReady } = await import("../../src/bootstrap");
    const render = vi.fn();
    expect(renderWhenReady(render)).toBeNull();
    expect(render).toHaveBeenCalledOnce();
  });
});
