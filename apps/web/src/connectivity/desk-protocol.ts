import { protocol as selected } from "../protocol";
import { connectivityProtocol } from "./write-guard";

/** Screen actions use the selected adapter with app-only guards. The shell only observes transport. */
export const protocol = connectivityProtocol(selected);
