import { screens } from "../../src/screens";

/** Test-only: settles every lazy screen import so renderToStaticMarkup(<App />) draws the screen in one pass. */
await screens.preload();
