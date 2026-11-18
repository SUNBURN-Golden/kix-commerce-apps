import { useCallback, useEffect, useSyncExternalStore } from "react";
import { ProtocolError, type Booking, type CommerceProtocol, type Hold, type Performance } from "@kix/protocol-adapter";
import { bookingQuantityNumber } from "./a11y/present";
import { heldAfterError, useRestoreFocus } from "./a11y/focus";
import { messages } from "./i18n/desk-catalogue";
import { protocol } from "./connectivity/desk-protocol";
import { connectedHandler, ConnectivityInterrupted } from "./connectivity/write-guard";

type Port = Pick<CommerceProtocol, "listPerformances" | "placeHold" | "releaseHold" | "confirmBooking">;
type Kind = "hold" | "release" | "confirm";
interface Pending { readonly token: symbol; readonly kind: Kind; readonly eventId: string; readonly quantity: number | null; readonly holdId: string | null }
export interface BookingContext {
  readonly eventId: string;
  readonly quantity: string;
  readonly performance: Performance | null;
  readonly readState: "idle" | "loading" | "ready" | "empty" | "error";
  readonly readError: string | null;
  readonly readGeneration: number;
  readonly hold: Hold | null;
  readonly booking: Booking | null;
  readonly writeError: string | null;
  readonly pending: Pending | null;
  readonly blocked: boolean;
  readonly errorControl: string;
}

/** Page-load memory only. Navigation never settles, cancels, or repeats dispatched work. */
export function createBookingContextStore({ port }: { port: Port }) {
  const records = new Map<string, BookingContext>();
  const listeners = new Set<() => void>();
  const reads = new Map<string, Promise<void>>();
  const getSnapshot = (eventId: string): BookingContext => {
    let record = records.get(eventId);
    if (!record) {
      record = Object.freeze({ eventId, quantity: "1", performance: null, readState: "idle", readError: null, readGeneration: 0,
        hold: null, booking: null, writeError: null, pending: null, blocked: false, errorControl: "booking-quantity" });
      records.set(eventId, record);
    }
    return record;
  };
  const patch = (eventId: string, change: Partial<BookingContext>) => {
    records.set(eventId, Object.freeze({ ...getSnapshot(eventId), ...change }));
    listeners.forEach((listener) => listener());
  };
  const read = (eventId: string): Promise<void> => {
    const generation = getSnapshot(eventId).readGeneration + 1;
    patch(eventId, { readGeneration: generation, readState: "loading", readError: null });
    const promise = (async () => {
      let performance = getSnapshot(eventId).performance;
      let readState: BookingContext["readState"];
      try {
        performance = (await port.listPerformances()).find((row) => row.eventId === eventId) ?? null;
        readState = performance ? "ready" : "empty";
      } catch { readState = "error"; }
      if (getSnapshot(eventId).readGeneration === generation) {
        patch(eventId, { performance, readState, readError: readState === "error" ? messages.en["desk.performance.singleLoadError"] : null });
      }
    })();
    reads.set(eventId, promise);
    return promise;
  };
  const load = (eventId: string) => reads.get(eventId) ?? read(eventId);
  const run = async (eventId: string, kind: Kind) => {
    const record = getSnapshot(eventId);
    if (!connectedHandler() || record.pending || record.blocked || record.booking) return;
    const quantity = bookingQuantityNumber(record.quantity);
    if (kind === "hold" ? record.hold || !record.performance : record.hold?.eventId !== eventId) return;
    if (kind === "hold" && quantity === null) {
      const held = heldAfterError({ controlId: "booking-quantity", value: record.quantity, selection: eventId }, true);
      patch(eventId, { quantity: held?.value ?? record.quantity, writeError: messages.en["desk.booking.quantityError"] });
      return;
    }
    const pending = Object.freeze({ token: Symbol(), kind, eventId, quantity: kind === "hold" ? quantity : null, holdId: record.hold?.holdId ?? null });
    // Acquire synchronously; invalidate reads dispatched before this write.
    patch(eventId, { pending, writeError: null, readGeneration: record.readGeneration + 1 });
    try {
      const result = kind === "hold" ? await port.placeHold({ eventId, quantity: quantity as number })
        : kind === "release" ? await port.releaseHold(pending.holdId as string) : await port.confirmBooking(pending.holdId as string);
      if (kind !== "release" && (!result || result.eventId !== eventId)) { patch(eventId, { blocked: true }); return; }
      const evidence = result && Object.freeze({ ...result });
      patch(eventId, kind === "hold" ? { hold: evidence as Hold } : { hold: null, ...(kind === "confirm" ? { booking: evidence as Booking } : {}) });
      // Refresh belongs to this operation, and cannot undo its successful result.
      await read(eventId);
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : messages.en[`desk.booking.${kind}Error`];
      patch(eventId, { writeError: error, errorControl: kind === "hold" ? "booking-quantity" : `booking-${kind}`, blocked: reason instanceof ConnectivityInterrupted });
      if (reason instanceof ProtocolError && (reason.code === "HOLD_EXPIRED" || reason.code === "HOLD_NOT_ACTIVE") && pending.holdId && getSnapshot(eventId).hold?.holdId === pending.holdId) {
        patch(eventId, { hold: null });
        await read(eventId);
      }
    } finally {
      const settled = getSnapshot(eventId);
      if (settled.pending?.token === pending.token) {
        patch(eventId, { pending: null });
      }
    }
  };
  return {
    getSnapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    load,
    setQuantity: (eventId: string, quantity: string) => {
      const record = getSnapshot(eventId);
      if (!record.pending && !record.blocked && !record.hold && !record.booking) patch(eventId, { quantity, writeError: null });
    },
    placeHold: (eventId: string) => run(eventId, "hold"),
    releaseHold: (eventId: string) => run(eventId, "release"),
    confirm: (eventId: string) => run(eventId, "confirm"),
  };
}
export type BookingContextStore = ReturnType<typeof createBookingContextStore>;
export const bookingContextStore = createBookingContextStore({ port: protocol });
export function useBookingContext(eventId: string, store = bookingContextStore) {
  const get = useCallback(() => store.getSnapshot(eventId), [store, eventId]);
  const snapshot = useSyncExternalStore(store.subscribe, get, get);
  useEffect(() => { void store.load(eventId); }, [store, eventId]);
  useRestoreFocus(snapshot.pending ? null : snapshot.writeError, snapshot.hold ? snapshot.errorControl : "booking-quantity");
  return snapshot;
}
