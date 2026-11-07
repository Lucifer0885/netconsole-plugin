// Node 25 throws if linkedom touches localStorage without this flag. WXT prepare does that.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const storage = resolve(root, ".cache/node-localstorage");
mkdirSync(dirname(storage), { recursive: true });

const child = spawn(
  process.execPath,
  [
    `--localstorage-file=${storage}`,
    resolve(root, "node_modules/wxt/bin/wxt.mjs"),
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", cwd: root },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
