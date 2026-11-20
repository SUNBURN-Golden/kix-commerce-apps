export const fixtureWritesOnNode = typeof process !== "undefined" &&
  process.release?.name === "node" && typeof window === "undefined";
