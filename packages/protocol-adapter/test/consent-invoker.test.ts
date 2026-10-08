import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  HttpProtocolAdapter,
  StubProtocolAdapter,
  consentInvokerFor,
  createProtocol,
  createStubConsentInvoker,
  type CommerceProtocol,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("consent invoker selection", () => {
  it("uses a shape-only invoker for the stub and leaves the stub without invokeLocalCall", async () => {
    const stub = createProtocol();
    expect(stub).toBeInstanceOf(StubProtocolAdapter);
    const selected = consentInvokerFor(stub);
    expect(selected?.source).toBe("stub-shape");
    expect(selected?.invoker).not.toBe(stub);
    expect("invokeLocalCall" in stub).toBe(false);
    const set = await selected?.invoker.invokeLocalCall({
      operationId: "op-set",
      actor: "subject-a",
      action: "set_consent",
      body: { allowed: true, expectedConsentVersion: 4 },
    });
    expect(set).toMatchObject({
      sequence: 1,
      action: "set_consent",
      result: { allowed: true, consentVersion: 1 },
    });
    const authorized = await selected?.invoker.invokeLocalCall({
      operationId: "op-auth",
      actor: "marketing-adapter",
      action: "authorize_marketing",
      body: { expectedConsentVersion: 4, subject: "subject-a" },
    });
    expect(authorized).toMatchObject({
      sequence: 2,
      action: "authorize_marketing",
      result: {
        authorizedAt: 0,
        consentVersion: 4,
        dispatchDecision: "AUTHORIZED_FIXTURE_INTENT",
        networkSendPerformed: false,
      },
    });
  });

  it("returns the http adapter itself for integration-gate", () => {
    const http = new HttpProtocolAdapter("http://127.0.0.1:9", async () => {
      throw new Error("unused");
    });
    const selected = consentInvokerFor(http);
    expect(selected).toEqual({ source: "integration-gate", invoker: http });
  });

  it("returns null for an unknown protocol", () => {
    expect(consentInvokerFor({} as CommerceProtocol)).toBeNull();
  });

  it("refuses any action outside the two", async () => {
    const invoker = createStubConsentInvoker();
    for (const action of ["capture", "settle_capture", "commit_trade", "admit", "create_event"]) {
      await expect(
        invoker.invokeLocalCall({
          operationId: "op-other",
          actor: "operator",
          action,
          body: {},
        }),
      ).rejects.toThrow(new RegExp(action));
    }
    const withdrawn = await invoker.invokeLocalCall({
      operationId: "op-withdraw",
      actor: "subject-a",
      action: "set_consent",
      body: { allowed: false },
    });
    expect(withdrawn).toMatchObject({ action: "set_consent", result: { allowed: false, consentVersion: 1 } });
  });

  it("does not construct the other adapter", () => {
    const source = readFileSync(path.join(here, "../src/consent-invoker.ts"), "utf8");
    expect(source).not.toContain("new StubProtocolAdapter");
    expect(source).not.toContain("new HttpProtocolAdapter");
    expect(source).not.toContain("fallback");
  });
});
