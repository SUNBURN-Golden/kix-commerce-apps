/**
 * Compares the wall clock (`Date.now`) with the monotonic clock (`performance.now`) on a short interval.
 *
 * Vitest 3.2 measures a test's displayed duration with the monotonic clock, but its after-the-test check
 * (`now() - startTime >= timeout` in `@vitest/runner`) reads `Date.now`. When the host pauses the process or
 * steps the wall clock forward, a one-second test fails as "timed out in 60000ms". This watcher records those
 * steps and event-loop stalls so a run record can tell a host pause from a hung page. On Linux it also reads the
 * kernel's memory, I/O and CPU pressure-stall counters, so a stall can be matched with a host that was reclaiming
 * memory. It changes no timeout.
 */

import fs from "node:fs";

/** Linux pressure-stall counters (`/proc/pressure/*`, cumulative microseconds) and free memory. Absent on other hosts. */
interface HostReading {
  memoryFullUs: number;
  memorySomeUs: number;
  ioFullUs: number;
  cpuSomeUs: number;
  memAvailableKb: number;
}

function stallTotal(file: string, kind: "some" | "full"): number {
  const match = new RegExp(`^${kind} .*total=(\\d+)`, "m").exec(fs.readFileSync(file, "utf8"));
  if (!match) {
    throw new Error(`no ${kind} line in ${file}`);
  }
  return Number(match[1]);
}

function readHost(): HostReading | null {
  try {
    const meminfo = /^MemAvailable:\s+(\d+) kB/m.exec(fs.readFileSync("/proc/meminfo", "utf8"));
    return {
      memoryFullUs: stallTotal("/proc/pressure/memory", "full"),
      memorySomeUs: stallTotal("/proc/pressure/memory", "some"),
      ioFullUs: stallTotal("/proc/pressure/io", "full"),
      cpuSomeUs: stallTotal("/proc/pressure/cpu", "some"),
      memAvailableKb: meminfo ? Number(meminfo[1]) : Number.NaN,
    };
  } catch {
    return null;
  }
}

/** Stall time the kernel counted while the watch ran, whole milliseconds. `full`: every runnable task was blocked. */
export interface HostPressure {
  memoryFullMs: number;
  memorySomeMs: number;
  ioFullMs: number;
  cpuSomeMs: number;
  /** The lowest MemAvailable seen, in whole MB. */
  memAvailableMinMb: number;
}

export interface ClockEvent {
  /** Monotonic ms since the watch began. */
  atMs: number;
  /** Wall time of the sample, to the second, UTC. Lets events from different runs be lined up. */
  at: string;
  /** Memory `full` stall ms the kernel counted in the interval of this event; null where the host has no pressure counters. */
  memoryFullMs: number | null;
  /** Wall ms elapsed minus monotonic ms elapsed since the previous sample. Positive: the wall clock ran ahead. */
  wallStepMs: number;
  /** Monotonic ms past the sampling interval: how long the event loop did not run. */
  loopStallMs: number;
}

export interface ClockReport {
  intervalMs: number;
  samples: number;
  maxWallStepMs: number;
  maxLoopStallMs: number;
  /** Samples at or above the report threshold, oldest first, at most `EVENT_CAP`. */
  events: ClockEvent[];
  /** Events beyond the cap. */
  droppedEvents: number;
  /** Null where the host has no pressure counters. */
  pressure: HostPressure | null;
}

export interface ClockWatch {
  stop: () => ClockReport;
}

const CLOCK_INTERVAL_MS = 250;
/** A step or stall at or above this is worth a line in the record. */
const CLOCK_REPORT_MS = 1000;
const EVENT_CAP = 20;

export function watchClock(intervalMs: number = CLOCK_INTERVAL_MS, reportMs: number = CLOCK_REPORT_MS): ClockWatch {
  const began = performance.now();
  let lastWall = Date.now();
  let lastMono = began;
  let samples = 0;
  let maxWallStepMs = 0;
  let maxLoopStallMs = 0;
  const events: ClockEvent[] = [];
  let dropped = 0;
  const first = readHost();
  let previous = first;
  let minAvailableKb = first?.memAvailableKb ?? Number.NaN;
  const sample = (): void => {
    const host = readHost();
    const memoryFullMs = host && previous ? Math.round((host.memoryFullUs - previous.memoryFullUs) / 1000) : null;
    if (host && !Number.isNaN(host.memAvailableKb)) {
      minAvailableKb = Number.isNaN(minAvailableKb) ? host.memAvailableKb : Math.min(minAvailableKb, host.memAvailableKb);
    }
    previous = host ?? previous;
    const wall = Date.now();
    const mono = performance.now();
    const wallStep = wall - lastWall - (mono - lastMono);
    const stall = Math.max(0, mono - lastMono - intervalMs);
    lastWall = wall;
    lastMono = mono;
    samples += 1;
    maxWallStepMs = Math.max(maxWallStepMs, Math.round(wallStep));
    maxLoopStallMs = Math.max(maxLoopStallMs, Math.round(stall));
    if (Math.abs(wallStep) >= reportMs || stall >= reportMs) {
      if (events.length < EVENT_CAP) {
        events.push({ atMs: Math.round(mono - began), at: new Date(wall).toISOString().slice(0, 19) + "Z", memoryFullMs, wallStepMs: Math.round(wallStep), loopStallMs: Math.round(stall) });
      } else {
        dropped += 1;
      }
    }
  };
  const timer = setInterval(sample, intervalMs);
  timer.unref();
  return {
    stop: () => {
      clearInterval(timer);
      // One last comparison, so a step during the final interval is not lost.
      sample();
      const pressure: HostPressure | null =
        first && previous
          ? {
              memoryFullMs: Math.round((previous.memoryFullUs - first.memoryFullUs) / 1000),
              memorySomeMs: Math.round((previous.memorySomeUs - first.memorySomeUs) / 1000),
              ioFullMs: Math.round((previous.ioFullUs - first.ioFullUs) / 1000),
              cpuSomeMs: Math.round((previous.cpuSomeUs - first.cpuSomeUs) / 1000),
              memAvailableMinMb: Number.isNaN(minAvailableKb) ? -1 : Math.round(minAvailableKb / 1024),
            }
          : null;
      return { intervalMs, samples, maxWallStepMs, maxLoopStallMs, events, droppedEvents: dropped, pressure };
    },
  };
}
