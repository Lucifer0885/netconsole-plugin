import type { Patch } from "./types";

export const ready: Patch = {
  id: "ready",
  apply(root) {
    if (root.documentElement.dataset.netconsole === "on") return;
    root.documentElement.dataset.netconsole = "on";
  },
};
