/** Browser-global typing for the test-only substituted port. No product import. */
export {};
declare global { interface Window { __kixResaleFault?: { mode: "reject" | "lost" | "held" | "wrong-side"; dispatches: number; release?: () => void } } }
