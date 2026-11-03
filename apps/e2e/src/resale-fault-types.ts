/** Browser-global typing for the test-only substituted port. No product import. */
export {};
declare global { interface Window { __kixResaleFault?: { mode: "reject" | "lost" | "held" | "wrong-side"; dispatches: number; reads?: number; history?: { count: number; wideCount: number; generation?: number; reverse?: boolean }; release?: () => void } } }
