import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_METHODS,
  OPENAPI_CONTRACT_PIN,
  PINNED_ACTIONS,
  isPinnedAction,
  readPinnedOpenApiDocument,
} from "@kix/protocol-adapter";
import {
  MARKETING_CONTRACT_ALIGNMENT,
  MARKETING_CONTRACT_IDS,
  MARKETING_FORBIDDEN_CALLS,
} from "../src/marketing/contracts";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function commandSchema(name: string): {
  properties: string[];
  required: string[];
  additionalProperties: unknown;
} {
  const doc = readPinnedOpenApiDocument();
  if (!doc || typeof doc !== "object") {
    throw new Error("Pinned OpenAPI document is missing.");
  }
  const components = (doc as { components?: unknown }).components;
  if (!components || typeof components !== "object") {
    throw new Error("Pinned OpenAPI components are missing.");
  }
  const schemas = (components as { schemas?: unknown }).schemas;
  if (!schemas || typeof schemas !== "object") {
    throw new Error("Pinned OpenAPI schemas are missing.");
  }
  const schema = (schemas as Record<string, unknown>)[name];
  if (!schema || typeof schema !== "object") {
    throw new Error(`Schema ${name} is missing.`);
  }
  const record = schema as {
    properties?: Record<string, unknown>;
    required?: unknown;
    additionalProperties?: unknown;
  };
  if (!record.properties || typeof record.properties !== "object") {
    throw new Error(`Schema ${name} has no properties.`);
  }
  if (!Array.isArray(record.required) || !record.required.every((item) => typeof item === "string")) {
    throw new Error(`Schema ${name} required set is not a string list.`);
  }
  return {
    properties: Object.keys(record.properties),
    required: record.required,
    additionalProperties: record.additionalProperties,
  };
}

describe("marketing contract alignment", () => {
  it("aligns M05 to the pinned set_consent and authorize_marketing schemas", () => {
    const row = MARKETING_CONTRACT_ALIGNMENT.M05;
    expect(row.state).toBe("published-not-bound");
    expect(row.boundBy).toBe("w7-m05-consent-bind");
    expect(OPENAPI_CONTRACT_PIN.contractStatus).toBe("contract-only");
    expect(OPENAPI_CONTRACT_PIN.productionEndpoint).toBe(false);
    expect(OPENAPI_CONTRACT_PIN.liveHttpServer).toBe(false);

    for (const name of row.published) {
      expect(isPinnedAction(name)).toBe(true);
      const schema = commandSchema(name);
      const recorded = row.commandFields[name];
      expect(schema.additionalProperties).toBe(false);
      expect(schema.properties).toEqual([...recorded.properties]);
      expect(schema.required).toEqual([...recorded.required]);
    }

    const union = [...row.commandFields.set_consent.properties, "subject"];
    expect([...row.missingFromStub]).toEqual(union);
    expect(row.commandFields.authorize_marketing.properties).toContain("subject");
    for (const field of row.stubFieldsNotTheBody) {
      expect(union).not.toContain(field);
    }
    expect(row.stubFieldsNotTheBody).toEqual(["performanceNotes", "membershipNotes"]);
  });

  it("M01–M04 name no pinned action", () => {
    const marketingish = PINNED_ACTIONS.filter((name) =>
      /marketing|membership|presale|coupon|referral|consent/i.test(name),
    );
    expect([...marketingish].sort()).toEqual(["authorize_marketing", "set_consent"]);

    for (const id of ["M01", "M02", "M03", "M04"] as const) {
      const row = MARKETING_CONTRACT_ALIGNMENT[id];
      expect(row.published).toBeNull();
      expect(row.state).toBe("no-published-command");
      expect(row.pendingContract).toBe("wave7-marketing-contracts");
      const blob = JSON.stringify(row);
      for (const action of PINNED_ACTIONS) {
        expect(blob).not.toContain(action);
      }
    }
    expect(MARKETING_CONTRACT_ALIGNMENT.M02.displayRead).toBe("listPerformances");
    expect(isPinnedAction("listPerformances")).toBe(false);
    expect(MARKETING_CONTRACT_IDS).toEqual(["M01", "M02", "M03", "M04", "M05"]);
  });

  it("holds field names only", () => {
    const seen: unknown[] = [];
    const walk = (value: unknown): void => {
      if (value === null) {
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          walk(item);
        }
        return;
      }
      if (typeof value === "object") {
        for (const child of Object.values(value)) {
          walk(child);
        }
        return;
      }
      seen.push(value);
    };
    walk(MARKETING_CONTRACT_ALIGNMENT);
    for (const value of seen) {
      expect(typeof value).toBe("string");
    }
  });

  it("marketing sources call no write", () => {
    const marketingSrc = sourceFiles(path.join(webRoot, "src/marketing"));
    const marketingPages = sourceFiles(path.join(webRoot, "src/pages/marketing"));

    for (const file of marketingSrc) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("readPinnedOpenApiDocument");
      expect(source, file).not.toContain("OPENAPI_CONTRACT_PIN");
      expect(source, file).not.toContain("PINNED_ACTIONS");
      expect(source, file).not.toContain("@kix/protocol-adapter");
      expect(source, file).not.toContain("fetch(");
    }

    const catalogueNotInWebSource = ["invokeLocalCall", "settle_capture"] as const;
    const callSurfaces = [...marketingSrc, ...marketingPages].filter((file) => !file.endsWith(`${path.sep}contracts.ts`));
    for (const file of callSurfaces) {
      const source = readFileSync(file, "utf8");
      for (const name of [...MARKETING_FORBIDDEN_CALLS, ...catalogueNotInWebSource]) {
        expect(source, `${path.relative(webRoot, file)} contains ${name}`).not.toContain(name);
      }
      expect(source, file).not.toContain("fetch(");
    }
    const webSrc = sourceFiles(path.join(webRoot, "src"));
    const webCombined = webSrc.map((file) => readFileSync(file, "utf8")).join("\n");
    for (const name of catalogueNotInWebSource) {
      expect(webCombined).not.toContain(name);
    }

    const listHits = [...marketingSrc, ...marketingPages].filter((file) =>
      readFileSync(file, "utf8").includes("listPerformances"),
    );
    expect(listHits.map((file) => path.basename(file)).sort()).toEqual(["M02Presale.tsx", "contracts.ts"]);

    const forbidden = new Set<string>(MARKETING_FORBIDDEN_CALLS);
    for (const method of COMMERCE_METHODS) {
      expect(forbidden.has(method)).toBe(method !== "listPerformances");
    }

    expect(readFileSync(path.join(webRoot, "vite.config.ts"), "utf8")).not.toContain("proxy");
    const bindings = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/commerce-bindings.ts"), "utf8");
    expect(bindings).toContain("placeHold({ eventId, quantity })");
    expect(bindings).toContain('consideredAction: "reserve_listing"');
  });
});
