import type { TrackName, TrackRecord } from "./types.js";

export interface TrackInput {
  name: TrackName;
  campaignId: string | null;
  detail: string;
}

/**
 * In-memory marketing log.
 * There is no transport: records are not beacons, pixels, or vendor calls.
 */
export class TrackingStub {
  private readonly records: TrackRecord[] = [];
  private seq = 0;

  readonly transport = "none" as const;

  constructor(
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextId: () => string = () => {
      this.seq += 1;
      return `track_${this.seq}`;
    },
  ) {}

  record(input: TrackInput): TrackRecord {
    const row: TrackRecord = {
      recordId: this.nextId(),
      name: input.name,
      campaignId: input.campaignId,
      detail: input.detail,
      at: this.now(),
      transport: "none",
      disposition: "stub-not-transmitted",
    };
    this.records.push(row);
    return row;
  }

  list(): TrackRecord[] {
    return this.records.map((row) => ({ ...row }));
  }

  clear(): void {
    this.records.length = 0;
  }
}
