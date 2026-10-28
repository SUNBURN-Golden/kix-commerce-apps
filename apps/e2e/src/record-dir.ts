/** The directory the global setup made for this run's line files. A leaf module, so record types can import the writers' types. */
export function recordDir(): string {
  const dir = process.env.KIX_E2E_RECORD_DIR;
  if (!dir) {
    throw new Error("KIX_E2E_RECORD_DIR is not set. The global setup sets it.");
  }
  return dir;
}
