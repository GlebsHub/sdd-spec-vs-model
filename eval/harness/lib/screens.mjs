import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { freePort } from "./ports.mjs";

const HARNESS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const ACCEPTANCE_SUPPORT = join(HARNESS_DIR, "..", "acceptance", "support");

/** Снимает скриншоты состояний в outDir. Возвращает список { name, ok, error }. */
export const takeScreenshots = async ({ copyDir, outDir }) => {
  const target = join(copyDir, ".screens");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(join(target, "support"), { recursive: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(join(HARNESS_DIR, "screens"), target, { recursive: true });
  cpSync(ACCEPTANCE_SUPPORT, join(target, "support"), { recursive: true });
  const port = await freePort();
  const child = spawnSync("npx", ["playwright", "test", "--config", join(".screens", "playwright.config.ts")], {
    cwd: copyDir,
    env: { ...process.env, SCREENS_PORT: String(port), SCREENS_OUT: outDir, CI: "1", FORCE_COLOR: "0" },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 15 * 60 * 1000,
  });
  rmSync(target, { recursive: true, force: true });
  const log = join(outDir, "screens.jsonl");
  const shots = existsSync(log)
    ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line))
    : [];
  rmSync(log, { force: true });
  return { shots, exitCode: child.status, stderrTail: (child.stderr ?? "").slice(-1500) };
};
