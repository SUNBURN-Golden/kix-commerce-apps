import type { SessionStorePort } from "../../src/index.js";

/** An in-memory stand-in for a tab's session storage, with switchable faults. */
export class FakeSessionStore implements SessionStorePort {
  readonly data = new Map<string, string>();
  /** setItem throws once the stored text would pass this many characters. */
  quota: number | null = null;
  /** setItem stores only this many characters and says nothing. */
  silentTruncate: number | null = null;
  /** setItem stores this many characters and then throws. */
  partialThenThrow: number | null = null;
  /** The partial and truncate faults hit one write, then clear, so a restore can succeed. */
  faultOnce = false;
  throwOnGet = false;
  throwOnSet = false;
  throwOnRemove = false;
  sets = 0;

  getItem(key: string): string | null {
    if (this.throwOnGet) {
      throw new Error("blocked");
    }
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.sets += 1;
    if (this.throwOnSet) {
      throw new Error("QuotaExceededError");
    }
    if (this.quota !== null && value.length > this.quota) {
      throw new Error("QuotaExceededError");
    }
    if (this.partialThenThrow !== null) {
      this.data.set(key, value.slice(0, this.partialThenThrow));
      if (this.faultOnce) {
        this.partialThenThrow = null;
      }
      throw new Error("partial");
    }
    const truncate = this.silentTruncate;
    if (truncate !== null && this.faultOnce) {
      this.silentTruncate = null;
    }
    this.data.set(key, truncate === null ? value : value.slice(0, truncate));
  }

  removeItem(key: string): void {
    if (this.throwOnRemove) {
      throw new Error("blocked");
    }
    this.data.delete(key);
  }
}
