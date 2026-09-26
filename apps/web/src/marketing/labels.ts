/**
 * ORIGINAL_32 marketing labels for Wave 7.
 * Status stays 설계중. These ids are charter names, not protocol types.
 */

export const MARKETING_SURFACES = [
  {
    id: "M01",
    path: "/marketing/m01",
    titleKo: "팬 자격 / 멤버십",
    titleEn: "Fan qualification / membership",
    blurbKo: "이번 페이지 로드에서만 쓰는 팬·멤버 카드입니다.",
    blurbEn: "Issue a session-only fan or member card for this page load.",
  },
  {
    id: "M02",
    path: "/marketing/m02",
    titleKo: "선예매",
    titleEn: "Presale",
    blurbKo: "데모 창에서 관심만 기록합니다. 예매 홀드는 만들지 않습니다.",
    blurbEn: "Record interest while a demo window is open. The booking desk is unchanged.",
  },
  {
    id: "M03",
    path: "/marketing/m03",
    titleKo: "쿠폰 / 프로모션",
    titleEn: "Coupon / promotion",
    blurbKo: "표시용 마커만 붙입니다. 가격과 결제 수단은 없습니다.",
    blurbEn: "Attach a display marker from a fixture list. No price and no tender.",
  },
  {
    id: "M04",
    path: "/marketing/m04",
    titleKo: "추천 / 리워드",
    titleEn: "Referral / rewards",
    blurbKo: "데모 마커만 셉니다. 크레딧은 지급하지 않습니다.",
    blurbEn: "Count demo markers from fixture referral codes. No credit is disbursed.",
  },
  {
    id: "M05",
    path: "/marketing/m05",
    titleKo: "CRM / 데이터 활용",
    titleEn: "CRM / data use",
    blurbKo: "동의 플래그만 세션에 남깁니다. 메시지는 보내지 않습니다.",
    blurbEn: "Store consent flags in this session. No channel and no send.",
  },
] as const;

export type MarketingId = (typeof MARKETING_SURFACES)[number]["id"];

export function marketingSurface(id: MarketingId) {
  const surface = MARKETING_SURFACES.find((item) => item.id === id);
  if (!surface) {
    throw new Error(`Unknown marketing label ${id}.`);
  }
  return surface;
}
