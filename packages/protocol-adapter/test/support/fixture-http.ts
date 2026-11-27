import { readFileSync } from "node:fs";
import { echoIntegrationGateHeaders } from "../../src/http-adapter.js";

// The receipt ledger supplies linked booking receipts. The remaining accept
// vectors were sent to the reviewed 4472b0f loopback gate and recorded here.
const vendor = new URL("../../vendor/", import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, vendor), "utf8"));
const { vectors } = read("kix-sdk-0/conformance/vectors/commerce-fixture-tuple.vectors.json") as {
  vectors: { id: string; expected: { receipt_ref?: string; receipt_fields?: Record<string, unknown> } }[];
};
const byId = new Map(vectors.map(vector => [vector.id, vector.expected]));
const recorded = JSON.parse(readFileSync(new URL("./fixture-http-receipts.json", import.meta.url), "utf8")) as {
  gate: string; receipts: Record<string, Record<string, unknown>>;
};
export const receiptGate = recorded.gate;

export function vectorFields(id: string) {
  const fields = byId.get(id)?.receipt_fields;
  if (!fields) throw new Error(`Missing vector receipt fields for ${id}`);
  return fields;
}

export function fixtureReceipt(id: string): Record<string, unknown> {
  const captured = recorded.receipts[id];
  if (captured) return structuredClone(captured);
  const [path, pointer] = (byId.get(id)?.receipt_ref ?? "").split("#/");
  if (!pointer) throw new Error(`Missing receipt for ${id}`);
  return pointer.split("/").reduce((value, key) => value[key], read(`commerce-journey/${path}`));
}

export function fixtureHttpResponse(url: string, init: RequestInit | undefined, body: object) {
  return Object.defineProperty(new Response(JSON.stringify(body), { headers: echoIntegrationGateHeaders(init) }), "url", { value: url });
}
