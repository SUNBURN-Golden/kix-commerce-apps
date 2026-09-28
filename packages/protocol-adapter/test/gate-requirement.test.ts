import { describe, expect, it } from "vitest";
import { gateRequired } from "./support/reviewed-gate.js";

describe("live gate requirement", () => {
  it("skips only on a local run with nothing configured", () => {
    expect(gateRequired({})).toBe(false);
    expect(gateRequired({ KIX_REQUIRE_GATE: "1" })).toBe(true);
    expect(gateRequired({ KIX_PROTOCOL_ROOT: "/wrong/path" })).toBe(true);
    expect(gateRequired({ CI: "true" })).toBe(true);
    expect(gateRequired({ CI: "true", KIX_REQUIRE_GATE: "0" })).toBe(false);
  });
});
