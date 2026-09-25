import type { ContentSlot, CreativeVariant } from "./types.js";
import { SLOT_BODY_MAX } from "./types.js";

/**
 * Copy a slot list and replace the hero and detail bodies from a variant.
 * The disclaimer and FAQ stay as authored. Input slots are not mutated.
 */
export function applyVariant(slots: readonly ContentSlot[], variant: CreativeVariant): ContentSlot[] {
  return slots.map((slot) => {
    if (slot.slotId === "hero") {
      return { ...slot, body: variant.hero };
    }
    if (slot.slotId === "detail") {
      return { ...slot, body: variant.detail };
    }
    return { ...slot };
  });
}

/**
 * Edit a local content slot. The disclaimer is fixed so the demo non-claim stays visible.
 */
export function updateSlot(slots: readonly ContentSlot[], slotId: string, body: string): ContentSlot[] {
  const nextBody = body.slice(0, SLOT_BODY_MAX);
  return slots.map((slot) => {
    if (slot.slotId !== slotId || !slot.editable) {
      return { ...slot };
    }
    return { ...slot, body: nextBody };
  });
}

export function slotBody(slots: readonly ContentSlot[], slotId: ContentSlot["slotId"]): string {
  return slots.find((slot) => slot.slotId === slotId)?.body ?? "";
}
