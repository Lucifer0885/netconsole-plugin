import { account } from "./account";
import { ready } from "./ready";
import { theme } from "./theme";
import type { Patch } from "./types";
import { visitNote } from "./visit-note";

export const patches: readonly Patch[] = [ready, theme, account, visitNote];
