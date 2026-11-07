import { existsSync } from "node:fs";
import { defineConfig } from "wxt";

const matches = ["https://netconsole.me/*", "https://*.netconsole.me/*"];

const brave = [
  "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  "C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
].find((path) => existsSync(path));

export default defineConfig({
  manifestVersion: 3,
  webExt: {
    binaries: brave ? { chrome: brave } : undefined,
  },
  manifest: {
    name: "Netconsole",
    description: "Internal UI patches for the netconsole.me admin.",
    permissions: ["storage"],
    host_permissions: matches,
    browser_specific_settings: {
      gecko: {
        id: "netconsole@battlenet3d.internal",
        strict_min_version: "128.0",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  },
});
