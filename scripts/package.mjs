/**
 * Builds the web app and packages it with electron-builder.
 *
 *   npm run package:linux            AppImage -> release/
 *
 * Electron 44 and electron-builder need Node 22.12 or newer. The game itself still runs on Node 18, so when this
 * script is started on an older Node it re-runs itself under a temporary Node 22 fetched by npx (nothing is
 * installed system-wide).
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(import.meta.url);
const root = join(dirname(here), "..");
const require = createRequire(import.meta.url);
const isWindows = process.platform === "win32";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.log(`Node ${process.versions.node} is too old for Electron 44 (needs 22.12+). Re-running under a temporary Node 22 via npx...`);
  const r = spawnSync("npx", ["-y", "-p", "node@22", "node", here, ...process.argv.slice(2)], { stdio: "inherit", cwd: root, shell: isWindows });
  process.exit(r.status ?? 1);
}

const target = process.argv[2] ?? "linux";
const flags = { linux: ["--linux", "AppImage"] }[target];
if (!flags) {
  console.error(`Unknown target "${target}". Supported: linux`);
  process.exit(2);
}

function run(label, script, args) {
  console.log(`\n== ${label}`);
  const r = spawnSync(process.execPath, [script, ...args], { stdio: "inherit", cwd: root });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

/** Path to a file inside an installed package, without relying on its "exports" map. */
const inPackage = (pkg, file) => join(dirname(require.resolve(`${pkg}/package.json`)), file);

run("typecheck", inPackage("typescript", "bin/tsc"), ["--noEmit"]);
run("build web app", inPackage("vite", "bin/vite.js"), ["build"]);
run("package", inPackage("electron-builder", "cli.js"), flags);
