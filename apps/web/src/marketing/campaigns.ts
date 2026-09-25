import { applyVariant } from "./slots.js";
import type { CampaignFixture, ContentSlot, CreativeVariant } from "./types.js";
import { DEMO_DISCLAIMER } from "./types.js";

interface CampaignDraft {
  campaignId: string;
  title: string;
  deskFixtureKey: string;
  summary: string;
  faq: string;
  variants: readonly CreativeVariant[];
}

function slotsFor(faq: string): ContentSlot[] {
  return [
    { slotId: "hero", label: "Hero", body: "", editable: true },
    { slotId: "detail", label: "Detail", body: "", editable: true },
    { slotId: "faq", label: "FAQ", body: faq, editable: true },
    { slotId: "disclaimer", label: "Disclaimer", body: DEMO_DISCLAIMER, editable: false },
  ];
}

function campaign(draft: CampaignDraft): CampaignFixture {
  const [first] = draft.variants;
  if (!first) {
    throw new Error(`Campaign ${draft.campaignId} needs a creative variant.`);
  }
  return {
    campaignId: draft.campaignId,
    title: draft.title,
    deskFixtureKey: draft.deskFixtureKey,
    summary: draft.summary,
    path: `/marketing/${draft.campaignId}`,
    variants: draft.variants,
    slots: applyVariant(slotsFor(draft.faq), first),
  };
}

/**
 * Local campaign fixtures. `deskFixtureKey` matches the Wave 6 in-memory desk seed
 * so a demo can deep-link when that stub is the adapter. It is not a protocol id.
 */
export const CAMPAIGNS: readonly CampaignFixture[] = [
  campaign({
    campaignId: "camp_lanterns_window",
    title: "North Station Lanterns",
    deskFixtureKey: "evt_lanterns",
    summary: "A late-window notice for Hall A. Demo copy only; the desk hold behind it moves no funds.",
    faq: "Does this page sell a seat? No. The booking desk only runs the simulated hold flow.",
    variants: [
      {
        variantId: "paper_notice",
        label: "Paper notice",
        hero: "The late window is a paper notice, not a checkout.",
        detail:
          "Hall A keeps a lantern line on the board. This page is the campaign. When the stub catalog still has this fixture, the booking desk only simulates a hold.",
      },
      {
        variantId: "quiet_listing",
        label: "Quiet listing",
        hero: "Listed quietly. No price on this page.",
        detail:
          "Use this variant when the campaign should read like a program note. Nothing here is an offer, a fee, or a confirmed seat.",
      },
    ],
  }),
  campaign({
    campaignId: "camp_paper_matinee",
    title: "Paper Orchestra matinee",
    deskFixtureKey: "evt_paper_orchestra",
    summary: "Hall B matinee notes for the paper orchestra. A landing shell, not a ticket.",
    faq: "Is the matinee time a promise? No. Time stays on the desk catalog. This campaign does not copy it into a contract.",
    variants: [
      {
        variantId: "program_note",
        label: "Program note",
        hero: "Matinee notes for a paper orchestra.",
        detail: "The campaign names the hall and the fixture. It does not confirm a booking, a resale, or an admission.",
      },
      {
        variantId: "short_bill",
        label: "Short bill",
        hero: "A short bill for Hall B.",
        detail: "Switching this variant only changes local copy. It is not an experiment and it reports no result.",
      },
    ],
  }),
  campaign({
    campaignId: "camp_last_ferry",
    title: "Last Ferry Diagram",
    deskFixtureKey: "evt_last_ferry",
    summary: "Studio-night campaign for a small room. The diagram is the creative; the desk is still a stub.",
    faq: "Can I track who clicked? Only inside this browser session. The log is not transmitted.",
    variants: [
      {
        variantId: "diagram",
        label: "Diagram",
        hero: "The diagram is the creative. The room is the studio.",
        detail: "Last Ferry stays a fixture key on the desk. This shell does not claim a gate, a right, or a payout.",
      },
      {
        variantId: "room_card",
        label: "Room card",
        hero: "The stub board still lists the studio. This page sells none of those seats.",
        detail:
          "The room card is a content slot. If you open the desk, capacity comes from the adapter in use, not from this campaign.",
      },
    ],
  }),
];

export function getCampaign(campaignId: string): CampaignFixture | null {
  return CAMPAIGNS.find((item) => item.campaignId === campaignId) ?? null;
}
