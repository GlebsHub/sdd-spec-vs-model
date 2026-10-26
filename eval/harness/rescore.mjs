#!/usr/bin/env node
/**
 * Повторная приёмка прогона без повторного запуска агента: копия базы + feature.diff прогона → приёмка.
 * Нужна, если после прогона исправили приёмочные тесты. Прежний результат приёмки сохраняется
 * в result.json → acceptanceHistory.
 *
 *   node eval/harness/rescore.mjs <папка результатов прогона> --reason "<что изменилось>" [--keep]
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { ACCEPTANCE_RUNNER, BASE_COMMIT, RUNS_ROOT, findConfig } from "./config.mjs";
import { prepareCopy } from "./lib/copy.mjs";
import { acceptanceArgs, scoreAcceptance } from "./lib/score.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { reason: { type: "string" }, keep: { type: "boolean", default: false } },
});
const resultDir = positionals[0] ? resolve(positionals[0]) : undefined;
if (!resultDir || !existsSync(join(resultDir, "result.json")) || !values.reason) {
  process.stderr.write('Usage: node eval/harness/rescore.mjs <папка результатов прогона> --reason "<что изменилось>" [--keep]\n');
  process.exit(2);
}

const resultPath = join(resultDir, "result.json");
const result = JSON.parse(readFileSync(resultPath, "utf8"));
if (result.baseCommit !== BASE_COMMIT) {
  throw new Error(`Прогон сделан на базе ${String(result.baseCommit)}, текущая база ${BASE_COMMIT}`);
}
const config = findConfig(result.config.id);
mkdirSync(RUNS_ROOT, { recursive: true });
const copyDir = join(RUNS_ROOT, `rescore-${config.id}-${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "")}`);

prepareCopy({ config, dir: copyDir });
execFileSync("git", ["apply", "--whitespace=nowarn", join(resultDir, "feature.diff")], { cwd: copyDir });

const acceptancePath = join(resultDir, "acceptance.json");
const previous = { at: result.acceptanceRescoredAt ?? result.finishedAt, ...result.acceptance };
spawnSync("node", acceptanceArgs(ACCEPTANCE_RUNNER, copyDir, acceptancePath), { stdio: ["ignore", "inherit", "inherit"] });
const acceptance = scoreAcceptance(JSON.parse(readFileSync(acceptancePath, "utf8")));

result.acceptanceHistory = [...(result.acceptanceHistory ?? []), { ...previous, replacedBecause: values.reason }];
result.acceptanceRescoredAt = new Date().toISOString();
result.acceptance = acceptance;
result.acPassed = acceptance.summary.passed;
result.acCounted = result.protection.violation ? 0 : result.acPassed;
result.accepted = result.status !== "infra_error" && result.acCounted === 15;
writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);

if (!values.keep) {
  rmSync(copyDir, { recursive: true, force: true });
  rmSync(`${copyDir}.json`, { force: true });
}
console.log(`AC ${String(previous.summary?.passed ?? "?")} → ${String(result.acPassed)}/15${acceptance.flaky.length ? `, нестабильны: ${acceptance.flaky.join(", ")}` : ""}`);
