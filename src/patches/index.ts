import { account } from "./account";
import { clientTypes } from "./client-types";
import { ready } from "./ready";
import { shiftTotal } from "./shift-total";
import { storeTasks } from "./store-tasks";
import { theme } from "./theme";
import type { Patch } from "./types";
import { visitNote } from "./visit-note";

export const patches: readonly Patch[] = [ready, theme, account, visitNote, clientTypes, storeTasks, shiftTotal];
