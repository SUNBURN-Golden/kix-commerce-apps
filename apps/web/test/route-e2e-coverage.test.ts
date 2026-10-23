import { describe, expect, it } from "vitest";
import { JOURNEYS } from "../../e2e/src/journey-matrix";
import { ROUTES } from "../src/shell/route-registry";
import { surfaceRowE2eProblems } from "./support/route-registry-checks";

describe("surface row browser coverage", () => {
  it("requires an e2e id or a reason for each surface row", () => {
    expect(surfaceRowE2eProblems(ROUTES)).toEqual([]);
    expect(ROUTES.filter((route) => route.evidence === "surface-row").map((route) => route.id).sort()).toEqual([...JOURNEYS].sort());
    expect(ROUTES.filter((route) => route.e2e !== null).map((route) => route.e2e).sort()).toEqual([...JOURNEYS].sort());
  });
  it("detects a missing journey and accepts an explicit gap note", () => {
    const missing = ROUTES.map((route) => route.id === "buyer" ? { ...route, e2e: null, note: undefined } : route);
    expect(surfaceRowE2eProblems(missing)).toEqual(["buyer: surface-row without e2e or note"]);
    expect(surfaceRowE2eProblems(missing.map((route) => route.id === "buyer" ? { ...route, note: "Documented gap" } : route))).toEqual([]);
  });
});
