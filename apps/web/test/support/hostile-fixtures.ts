export const HOSTILE_FIXTURES = {
  html: `<img src=x onerror="globalThis.__kixOwned=1">`,
  javascriptUrl: "javascript:globalThis.__kixOwned=1",
  long: "L".repeat(500),
  bidi: "safe\u202Etxt\u2066end",
  controls: "first\u0000second\u001fthird",
  emoji: "ticket-🎟️-관람",
  bearer: "Bearer abcdefgh12345678",
} as const;
