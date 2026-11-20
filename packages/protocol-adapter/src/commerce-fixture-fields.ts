// Synthetic reservation and resale fields at the 8ba7f6c mock_gates.py pin.
export const FIXTURE_PAYMENT_REF = /^[0-9a-f]{64}$/;

export function inFixtureOfferWindow(remainingMs: number): boolean {
  return remainingMs > 0 && remainingMs <= 900_000;
}

export function validFixtureAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0 && amount <= 1_000_000_000_000;
}
