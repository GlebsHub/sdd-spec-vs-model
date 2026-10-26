#!/usr/bin/env node
/**
 * Раннер скрытой приёмки.
 *
 *   node eval/acceptance/run.mjs <папка копии> [--out result.json] [--repeat N] [--workers N]
 *
 * 1. Копирует eval/acceptance в <копия>/.acceptance/ (оттуда видны node_modules копии).
 * 2. Запускает Playwright с конфигом приёмки: свой dev-сервер копии на свободном порту.
 * 3. Группирует тесты по префиксу «AC-NN»: критерий прошёл, если прошли все его тесты.
 * 4. Пишет JSON с итогом по каждому AC и причиной провала. При --repeat N — по каждому прогону
 *    и список нестабильных критериев (в разных прогонах разный результат).
 * Если приложение не поднялось, все AC получают failed с причиной; раннер не падает.
 * После прогона .acceptance/ удаляется.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ACCEPTANCE_DIR = dirname(fileURLToPath(import.meta.url));
const CRITERIA = Array.from({ length: 15 }, (_, index) => `AC-${String(index + 1).padStart(2, "0")}`);
const ANSI = /\u001b\[[0-9;]*m/g;

const freePort = () =>
  new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => {
        resolvePort(typeof address === "object" && address ? address.port : 0);
      });
    });
  });

const firstLine = (text) =>
  (text ?? "")
    .replace(ANSI, "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";

/** Сообщение ошибки: первая строка плюс строки Expected / Received, если есть. */
const describeError = (error) => {
  const message = (error?.message ?? error?.value ?? "").replace(ANSI, "");
  const lines = message.split("\n").map((line) => line.trim());
  const details = lines.filter((line) => /^(Expected|Received|Locator|Timeout|Call log)/.test(line)).slice(0, 3);
  return [firstLine(message), ...details].filter(Boolean).join(" | ").slice(0, 600);
};

/** Обходит дерево сьютов JSON-репортера Playwright. */
const collectTests = (suites, out = []) => {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const result = test.results?.at(-1);
        out.push({
          title: spec.title,
          file: spec.file ?? suite.file,
          status: result?.status ?? "skipped",
          durationMs: result?.duration ?? 0,
          error: result && result.status !== "passed" ? describeError(result.error ?? result.errors?.[0]) : undefined,
        });
      }
    }
    collectTests(suite.suites, out);
  }
  return out;
};

const summarize = (tests, infraError) => {
  const criteria = {};
  for (const id of CRITERIA) {
    const own = tests.filter((test) => test.title.startsWith(`${id} `) || test.title === id);
    const failed = own.filter((test) => test.status !== "passed");
    let reason;
    if (infraError) {
      reason = infraError;
    } else if (own.length === 0) {
      reason = "Нет тестов для критерия";
    } else if (failed.length > 0) {
      reason = `${failed[0].title}: ${failed[0].error ?? failed[0].status}`;
    }
    criteria[id] = {
      status: !infraError && own.length > 0 && failed.length === 0 ? "passed" : "failed",
      ...(reason ? { reason } : {}),
      tests: own,
    };
  }
  const passed = Object.values(criteria).filter((criterion) => criterion.status === "passed").length;
  return { summary: { passed, failed: CRITERIA.length - passed, total: CRITERIA.length }, criteria };
};

const runOnce = async (copyDir, workers) => {
  const target = join(copyDir, ".acceptance");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const name of ["playwright.config.ts", "support", "tests"]) {
    cpSync(join(ACCEPTANCE_DIR, name), join(target, name), { recursive: true });
  }
  const reportPath = join(target, "report.json");
  const port = await freePort();
  const startedAt = new Date();
  const child = spawnSync("npx", ["playwright", "test", "--config", join(".acceptance", "playwright.config.ts")], {
    cwd: copyDir,
    env: {
      ...process.env,
      ACCEPTANCE_PORT: String(port),
      ACCEPTANCE_WORKERS: String(workers),
      ACCEPTANCE_REPORT: reportPath,
      CI: "1",
      FORCE_COLOR: "0",
    },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const durationMs = Date.now() - startedAt.getTime();

  let tests = [];
  let infraError;
  if (existsSync(reportPath)) {
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    tests = collectTests(report.suites);
    const globalErrors = (report.errors ?? []).map(describeError).filter(Boolean);
    if (tests.length === 0) {
      infraError = globalErrors[0] ?? "Playwright не запустил ни одного теста";
    }
  } else {
    infraError = firstLine(child.stderr) || firstLine(child.stdout) || `Playwright завершился с кодом ${String(child.status)}`;
  }
  rmSync(target, { recursive: true, force: true });
  return { startedAt: startedAt.toISOString(), durationMs, exitCode: child.status, ...summarize(tests, infraError) };
};

const readBaseCommit = (copyDir) => {
  try {
    return JSON.parse(readFileSync(`${copyDir}.json`, "utf8")).baseCommit ?? null;
  } catch {
    const log = spawnSync("git", ["log", "--reverse", "--format=%s"], { cwd: copyDir, encoding: "utf8" });
    return /^base ([0-9a-f]{40})/m.exec(log.stdout ?? "")?.[1] ?? null;
  }
};

const main = async () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string" },
      repeat: { type: "string", default: "1" },
      workers: { type: "string", default: "4" },
    },
  });
  const copyDir = positionals[0] ? resolve(positionals[0]) : undefined;
  if (!copyDir || !existsSync(join(copyDir, "package.json"))) {
    process.stderr.write("Usage: node eval/acceptance/run.mjs <папка копии> [--out file] [--repeat N] [--workers N]\n");
    process.exit(2);
  }
  const repeat = Math.max(1, Number(values.repeat));
  const runs = [];
  for (let index = 0; index < repeat; index += 1) {
    const run = await runOnce(copyDir, Number(values.workers));
    runs.push(run);
    process.stderr.write(
      `run ${String(index + 1)}/${String(repeat)}: ${String(run.summary.passed)}/${String(run.summary.total)} passed (${String(Math.round(run.durationMs / 1000))} s)\n`,
    );
  }

  const last = runs.at(-1);
  const flaky = CRITERIA.filter((id) => new Set(runs.map((run) => run.criteria[id].status)).size > 1);
  const result = {
    copy: copyDir,
    baseCommit: readBaseCommit(copyDir),
    runs: runs.length,
    ...(repeat > 1 ? { flaky, perRun: runs.map((run) => ({ startedAt: run.startedAt, durationMs: run.durationMs, summary: run.summary, failed: CRITERIA.filter((id) => run.criteria[id].status === "failed") })) } : {}),
    startedAt: runs[0].startedAt,
    durationMs: runs.reduce((sum, run) => sum + run.durationMs, 0),
    // Критерий считается пройденным, только если прошёл во всех прогонах.
    summary: (() => {
      const passed = CRITERIA.filter((id) => runs.every((run) => run.criteria[id].status === "passed")).length;
      return { passed, failed: CRITERIA.length - passed, total: CRITERIA.length };
    })(),
    criteria: Object.fromEntries(
      CRITERIA.map((id) => {
        const failedRun = runs.find((run) => run.criteria[id].status === "failed");
        const source = failedRun ?? last;
        return [id, { ...source.criteria[id], status: failedRun ? "failed" : "passed" }];
      }),
    ),
  };

  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (values.out) {
    writeFileSync(resolve(values.out), json);
  } else {
    process.stdout.write(json);
  }
  for (const id of CRITERIA) {
    const criterion = result.criteria[id];
    process.stderr.write(`${id} ${criterion.status === "passed" ? "✓" : "✗"}${criterion.reason ? `  ${criterion.reason.slice(0, 160)}` : ""}\n`);
  }
  if (flaky.length > 0) {
    process.stderr.write(`flaky: ${flaky.join(", ")}\n`);
  }
};

await main();
