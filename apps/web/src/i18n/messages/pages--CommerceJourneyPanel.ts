import { messages as desk } from "../desk-catalogue";

const en = {
  title: "Protocol commerce journey",
  paymentObservation: "Payment observation", ticketIssuance: "Ticket issuance", admission: "Admission",
  resale: "Resale", reservationCancellation: "Reservation cancellation", refundBinding: "Mock refund binding", refundAcceptance: "Mock refund acceptance", refund: "Cancel and refund",
  confirmed: "Last confirmed step", pending: "Sending", blocked: "Blocked next step",
  openElsewhere: "This page load already has a fixture journey on another booking.",
  read: "Read current booking", readReason: "The pinned gate has no booking read endpoint.",
};
const ko = {
  title: "프로토콜 거래 여정",
  paymentObservation: "결제 관측", ticketIssuance: "티켓 발급", admission: "입장",
  resale: "재판매", reservationCancellation: "예약 취소", refundBinding: "모의 환불 연결", refundAcceptance: "모의 환불 수락", refund: "취소 및 환불",
  confirmed: "마지막 확인 단계", pending: "전송 중", blocked: "차단된 다음 단계",
  openElsewhere: "이 페이지 로드에서 다른 예매의 거래 여정이 이미 열려 있습니다.",
  read: "현재 예매 조회", readReason: "고정 게이트에 예매 조회 엔드포인트가 없습니다.",
};

export const messages = {
  en: { ...en, steps: {
    "reservation-clock": "Set reservation clock", "register-show": "Register fixture show",
    "reserve-A": desk.en["desk.booking.place"], "reserve-B": desk.en["desk.booking.place"], "reserve-C": desk.en["desk.booking.place"],
    "order-A": desk.en["desk.booking.confirm"], "order-B": desk.en["desk.booking.confirm"], "order-C": desk.en["desk.booking.confirm"],
    "payment-A": "Observe payment", "payment-B": "Observe payment", "issue-A": "Issue ticket", "issue-B": "Issue ticket",
    "resale-clock": "Set resale clock", "adopt-A": "Adopt issued right for resale", "list-A": desk.en["desk.booking.resale"],
    "hold-A": "Hold listing", "resale-payment-A": "Observe resale payment", "bind-resale": "Bind resale settlement",
    "accept-A": desk.en["desk.resale.transfer"], "accept-A-before-commit": "Try transfer before commit",
    "distribute-resale": "Record mock distribution", "settle-resale-commit": "Commit mock settlement",
    "settle-resale-initiate": "Open resale settlement", "settle-resale-authorize": "Authorize mock settlement",
    "mock-claim": "Record mock claim", "admission-clock": "Set admission clock",
    "adopt-B": "Adopt issued right for admission", "authorize-B": "Authorize admission", "consume-B": "Consume admission",
    "double-consume": "Try second consumption", "cancel-C": "Cancel reservation", "cancel-after-payment": "Try cancellation after payment",
    "settle-cancel-initiate": "Open cancellation case", "settle-cancel": "Cancel mock settlement", "issue-cancelled": "Try issue after cancellation",
    "settle-fail-initiate": "Open settlement failure case", "settle-fail": "Record mock settlement failure",
    "settle-refund-initiate": "Open independent refund fixture", "settle-refund-authorize": "Authorize mock settlement",
    "bind-refund": "Bind mock refund", "observe-mock-acceptance": "Observe mock refund acceptance",
    "hold-over-capacity": "Try unavailable slot", "hold-occupied-slot": "Try occupied slot",
  } },
  ko: { ...ko, steps: {
    "reservation-clock": "예약 기준 시각 설정", "register-show": "모의 공연 등록",
    "reserve-A": desk.ko["desk.booking.place"], "reserve-B": desk.ko["desk.booking.place"], "reserve-C": desk.ko["desk.booking.place"],
    "order-A": desk.ko["desk.booking.confirm"], "order-B": desk.ko["desk.booking.confirm"], "order-C": desk.ko["desk.booking.confirm"],
    "payment-A": "결제 관측", "payment-B": "결제 관측", "issue-A": "티켓 발급", "issue-B": "티켓 발급",
    "resale-clock": "재판매 기준 시각 설정", "adopt-A": "발급 권리를 재판매에 연결", "list-A": desk.ko["desk.booking.resale"],
    "hold-A": "재판매 보류", "resale-payment-A": "재판매 결제 관측", "bind-resale": "재판매 정산 연결",
    "accept-A": desk.ko["desk.resale.transfer"], "accept-A-before-commit": "정산 확정 전 이전 시도",
    "distribute-resale": "모의 배분 기록", "settle-resale-commit": "모의 정산 확정",
    "settle-resale-initiate": "재판매 정산 열기", "settle-resale-authorize": "모의 정산 승인",
    "mock-claim": "모의 채권 기록", "admission-clock": "입장 기준 시각 설정",
    "adopt-B": "발급 권리를 입장에 연결", "authorize-B": "입장 승인", "consume-B": "입장 사용",
    "double-consume": "입장 재사용 시도", "cancel-C": "예약 취소", "cancel-after-payment": "결제 관측 후 취소 시도",
    "settle-cancel-initiate": "취소 사례 열기", "settle-cancel": "모의 정산 취소", "issue-cancelled": "취소 후 발급 시도",
    "settle-fail-initiate": "정산 실패 사례 열기", "settle-fail": "모의 정산 실패 기록",
    "settle-refund-initiate": "별도 모의 환불 사례 열기", "settle-refund-authorize": "모의 정산 승인",
    "bind-refund": "모의 환불 연결", "observe-mock-acceptance": "모의 환불 수락 관측",
    "hold-over-capacity": "정원 외 좌석 보류 시도", "hold-occupied-slot": "사용 중 좌석 보류 시도",
  } },
} as const;
