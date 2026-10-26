#!/usr/bin/env node
/**
 * Харнесс прогонов. Прогоны строго последовательные.
 *
 *   node eval/harness/run.mjs --round <N>              прогон №N каждой конфигурации (порядок сдвигается по кругу)
 *   node eval/harness/run.mjs --only <config>:<N>      один прогон
 *   node eval/harness/run.mjs --pilot <config>         пилот: eval/results/_pilot/<config>/<время>, в сводку не входит
 *   node eval/harness/run.mjs --finish <папка логов прогона>  довести прогон после сбоя харнесса (агент не перезапускается)
 *   … [--time-limit 25m] [--max-turns 300] [--keep] [--dry-run]
 *
 * Готовые прогоны (result.json со статусом complete или timeout) пропускаются; незавершённые и infra_error
 * переносятся в eval/results/_aborted/ и запускаются заново.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { REPO_ROOT } from "../lib/make-copy.mjs";
import {
  ACCEPTANCE_RUNNER,
  AGENT_PORT,
  BASE_COMMIT,
  CONFIGS,
  DOCUMENTED_DEFAULT_EFFORT,
  LIMITS,
  LOGS_ROOT,
  REFERENCE_COPIES_ROOT,
  RESULTS_DIR,
  RUNS_PER_CONFIG,
  RUNS_ROOT,
  TOKEN_FILE,
  configsForRound,
  findConfig,
} from "./config.mjs";
import { agentEnv, isPortFree, killLeftovers, readUsageWindow, runAgent } from "./lib/agent.mjs";
import { installCheckStubs, prepareCopy, restoreCheckStubs } from "./lib/copy.mjs";
import { PRICES } from "./lib/cost.mjs";
import { compareProtected, hashProtected, hashProtectedAtCommit } from "./lib/protect.mjs";
import { acceptanceArgs, scoreAcceptance } from "./lib/score.mjs";
import { takeScreenshots } from "./lib/screens.mjs";
import { analyzeTranscript } from "./lib/transcript.mjs";
import { sameSessionWindow, waitForWindowRoom } from "./lib/window.mjs";

const HARNESS_DIR = import.meta.dirname;
const DONE_STATUSES = new Set(["complete", "timeout"]);

const timestamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");

const parseDuration = (value) => {
  const match = /^(\d+)(s|m)?$/.exec(value ?? "");
  if (!match) throw new Error(`Bad duration "${value}", expected e.g. 25m or 90s`);
  return Number(match[1]) * (match[2] === "s" ? 1000 : 60_000);
};

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

const listFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? listFiles(path) : [path];
      })
    : [];

/** Список прогонов по аргументам. */
const planRuns = (values) => {
  if (values.pilot) {
    const config = findConfig(values.pilot);
    return [{ config, run: null, label: "pilot", resultDir: join(RESULTS_DIR, "_pilot", config.id, timestamp()), pilot: true }];
  }
  if (values.only) {
    const [id, run] = values.only.split(":");
    const config = findConfig(id);
    const number = Number(run);
    if (!Number.isInteger(number) || number < 1 || number > RUNS_PER_CONFIG) throw new Error(`Bad run number in --only ${values.only}`);
    return [{ config, run: number, label: `run${String(number)}`, resultDir: join(RESULTS_DIR, config.id, String(number)), pilot: false }];
  }
  if (values.round) {
    const round = Number(values.round);
    if (!Number.isInteger(round) || round < 1 || round > RUNS_PER_CONFIG) throw new Error(`Bad --round ${values.round}`);
    return configsForRound(round).map((config) => ({
      config,
      run: round,
      label: `run${String(round)}`,
      resultDir: join(RESULTS_DIR, config.id, String(round)),
      pilot: false,
    }));
  }
  throw new Error("Specify --round N, --only <config>:<N> or --pilot <config>");
};

const isDone = (resultDir) => DONE_STATUSES.has(readJson(join(resultDir, "result.json"))?.status);

const moveToAborted = (resultDir, config, label) => {
  if (!existsSync(resultDir)) return;
  const target = join(RESULTS_DIR, "_aborted", `${config.id}-${label}-${timestamp()}`);
  mkdirSync(join(RESULTS_DIR, "_aborted"), { recursive: true });
  renameSync(resultDir, target);
  console.log(`  незавершённый прогон перенесён в ${relative(REPO_ROOT, target)}`);
};

const precheck = () => {
  if (!existsSync(TOKEN_FILE) || readFileSync(TOKEN_FILE, "utf8").trim() === "") {
    throw new Error(`Нет токена ${TOKEN_FILE}. Выполните: claude setup-token и сохраните токен в этот файл (chmod 600).`);
  }
  execFileSync("git", ["cat-file", "-e", `${BASE_COMMIT}^{commit}`], { cwd: REPO_ROOT });
  if (!isPortFree(AGENT_PORT)) {
    throw new Error(`Порт ${String(AGENT_PORT)} занят: остановите dev-сервер, агенту нужен этот порт.`);
  }
  // Копии эталона и голой базы не должны лежать там, где агент может их найти.
  if (existsSync(REFERENCE_COPIES_ROOT)) {
    rmSync(REFERENCE_COPIES_ROOT, { recursive: true, force: true });
    console.log(`  удалены копии эталона: ${REFERENCE_COPIES_ROOT}`);
  }
};

/** Пути, недоступные агенту: репозиторий стенда, копии эталона, логи прогонов. */
const forbiddenPaths = () => [REPO_ROOT, `${REFERENCE_COPIES_ROOT}/`, LOGS_ROOT];

const writeRunSettings = ({ privDir, guardLog, contour }) => {
  const hookPath = join(privDir, "guard-hook.mjs");
  copyFileSync(join(HARNESS_DIR, "lib", "guard-hook.mjs"), hookPath);
  const forbidden = forbiddenPaths();
  const encoded = Buffer.from(forbidden.join("\n")).toString("base64");
  const deny = forbidden.flatMap((path) =>
    ["Read", "Edit", "Write", "Glob", "Grep"].map((tool) => `${tool}(/${path.replace(/\/$/, "")}/**)`),
  );
  const settings = {
    permissions: { deny },
    hooks: {
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [{ type: "command", command: `node '${hookPath}' '${guardLog}' ${contour ? "on" : "off"} ${encoded}` }],
        },
      ],
    },
  };
  const settingsPath = join(privDir, "settings.json");
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  return settingsPath;
};

/** Дифф агента относительно базового коммита копии. */
const collectDiffs = ({ copyDir, baseSha, resultDir }) => {
  const git = (...args) => execFileSync("git", args, { cwd: copyDir, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  // node_modules, test-results и т. п. исключает .gitignore базы; .acceptance и .screens к этому моменту удалены.
  git("add", "-A");
  writeFileSync(join(resultDir, "feature.diff"), git("diff", "--cached", baseSha));
  writeFileSync(join(resultDir, "queryClient.diff"), git("diff", "--cached", baseSha, "--", "src/shared/api/queryClient.ts"));
  return git("diff", "--cached", "--numstat", baseSha)
    .trim()
    .split("\n")
    .filter(Boolean)
    .reduce(
      (sum, line) => {
        const [added, removed] = line.split("\t");
        return { files: sum.files + 1, added: sum.added + (Number(added) || 0), removed: sum.removed + (Number(removed) || 0) };
      },
      { files: 0, added: 0, removed: 0 },
    );
};

/** Признаки того, что агент видел скрытые тесты, эталон или репозиторий стенда. */
const scanLeaks = (transcriptText, guardLog) => {
  const markers = [REPO_ROOT, `${REFERENCE_COPIES_ROOT}/`, "eval/acceptance", "eval/reference", "__acceptance_oracle", LOGS_ROOT];
  const found = markers.filter((marker) => transcriptText.includes(marker));
  const guardHits = existsSync(guardLog)
    ? readFileSync(guardLog, "utf8").split("\n").filter((line) => line.includes(" forbidden-path ")).length
    : 0;
  return { leakSuspect: found.length > 0 || guardHits > 0, markers: found, forbiddenPathAttempts: guardHits };
};

const countLines = (path, filter = () => true) =>
  existsSync(path) ? readFileSync(path, "utf8").split("\n").filter((line) => line.trim() !== "" && filter(line)).length : 0;

/** Удаляет токен из файла; возвращает true, если он там был. */
const redactFile = (path, token) => {
  const text = readFileSync(path, "utf8");
  if (!text.includes(token)) return false;
  writeFileSync(path, text.split(token).join("[REDACTED]"));
  return true;
};

const makeLogger = (logDir) => {
  const harnessLog = join(logDir, "harness.log");
  return (message) => {
    appendFileSync(harnessLog, `${new Date().toISOString()} ${message}\n`);
    console.log(`  ${message}`);
  };
};

/** Фаза 1: копия, агент, остановка процессов. Состояние сохраняется в state.json для доводки через --finish. */
const runOne = async (plan, options) => {
  const { config } = plan;
  const stamp = timestamp();
  const logDir = join(LOGS_ROOT, config.id, `${plan.label}-${stamp}`);
  const privDir = join(logDir, "private");
  const copyDir = join(RUNS_ROOT, `${config.id}-${plan.label}-${stamp}`);
  // Папка конфигурации CLI — вне запрещённых путей: туда CLI сохраняет длинный вывод инструментов, и агент его читает.
  const configDir = `${copyDir}.claude-config`;
  mkdirSync(privDir, { recursive: true });
  mkdirSync(configDir, { recursive: true });
  mkdirSync(RUNS_ROOT, { recursive: true });
  const log = makeLogger(logDir);

  const token = readFileSync(TOKEN_FILE, "utf8").trim();
  const env = agentEnv({ token, configDir });
  const startedAt = new Date().toISOString();

  log(`копия: ${copyDir}`);
  const usageBefore = readUsageWindow({ cwd: RUNS_ROOT });
  log(`окно лимитов до: сессия ${String(usageBefore.sessionPercent)}%, неделя ${String(usageBefore.weekPercent)}%`);

  const copy = prepareCopy({ config, dir: copyDir });
  const blockLog = join(logDir, "blocked-bins.log");
  const guardLog = join(logDir, "guard.log");
  const stubs = config.contour ? {} : installCheckStubs({ dir: copyDir, blockLog });
  const settingsPath = writeRunSettings({ privDir, guardLog, contour: config.contour });
  const hashesBefore = hashProtected(copyDir);

  log(`агент: ${config.model}, лимит ${String(Math.round(options.timeMs / 60000))} мин, ${String(options.maxTurns)} ходов`);
  const agent = await runAgent({
    cwd: copyDir,
    env,
    model: config.model,
    settingsPath,
    transcriptPath: join(logDir, "transcript.jsonl"),
    stderrPath: join(logDir, "stderr.log"),
    timeMs: options.timeMs,
    maxTurns: options.maxTurns,
  });
  log(`агент завершился: ${agent.timedOut ? "таймаут" : `код ${String(agent.exitCode)}`}, ${String(Math.round(agent.wallMs / 1000))} с`);
  const killed = killLeftovers({ dir: copyDir, port: AGENT_PORT });
  if (killed.length > 0) log(`остановлены оставленные процессы: ${killed.join(", ")}`);
  restoreCheckStubs({ dir: copyDir, originals: stubs });
  rmSync(configDir, { recursive: true, force: true });
  if (agent.interrupted) {
    log("прервано пользователем (Ctrl+C): прогон не засчитан, при следующем запуске круга начнётся заново");
    rmSync(copyDir, { recursive: true, force: true });
    rmSync(`${copyDir}.json`, { force: true });
    process.exit(130);
  }

  const state = {
    plan: { configId: config.id, run: plan.run, label: plan.label, resultDir: plan.resultDir, pilot: plan.pilot },
    options,
    startedAt,
    logDir,
    copyDir,
    baseSha: copy.baseSha,
    baseCommit: copy.baseCommit,
    usageBefore,
    hashesBefore,
    agent: { exitCode: agent.exitCode, signal: agent.signal, timedOut: agent.timedOut, wallMs: agent.wallMs },
    killed,
  };
  writeFileSync(join(logDir, "state.json"), `${JSON.stringify(state, null, 2)}\n`);
  return finishRun(state);
};

/** Фаза 2: защита, артефакты, приёмка, скриншоты, метрики, result.json. Повторяема по state.json. */
const finishRun = async (state) => {
  const config = findConfig(state.plan.configId);
  const plan = { ...state.plan, config };
  const { logDir, copyDir, options } = state;
  const log = makeLogger(logDir);
  const token = readFileSync(TOKEN_FILE, "utf8").trim();
  const transcriptPath = join(logDir, "transcript.jsonl");
  const stderrPath = join(logDir, "stderr.log");
  const blockLog = join(logDir, "blocked-bins.log");
  const guardLog = join(logDir, "guard.log");
  if (!existsSync(copyDir)) throw new Error(`Копия прогона не найдена: ${copyDir}`);
  if (!existsSync(transcriptPath)) throw new Error(`Лог агента не найден: ${transcriptPath}`);

  const hashesBefore = state.hashesBefore ?? hashProtectedAtCommit(copyDir, state.baseSha);
  const violations = compareProtected(hashesBefore, hashProtected(copyDir));
  if (violations.length > 0) log(`НАРУШЕНИЕ ЗАЩИТЫ: ${violations.map((item) => `${item.file} (${item.change})`).join(", ")}`);

  const transcriptText = readFileSync(transcriptPath, "utf8");
  const analysis = analyzeTranscript(transcriptText.split("\n"));

  rmSync(plan.resultDir, { recursive: true, force: true });
  mkdirSync(plan.resultDir, { recursive: true });
  const planPath = join(copyDir, "PLAN.md");
  const hasPlan = existsSync(planPath);
  if (hasPlan) copyFileSync(planPath, join(plan.resultDir, "PLAN.md"));
  const diffStat = collectDiffs({ copyDir, baseSha: state.baseSha, resultDir: plan.resultDir });

  log("приёмка…");
  const acceptancePath = join(plan.resultDir, "acceptance.json");
  spawnSync("node", acceptanceArgs(ACCEPTANCE_RUNNER, copyDir, acceptancePath), { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] });
  const acceptance = scoreAcceptance(readJson(acceptancePath));
  log(`приёмка: ${String(acceptance?.summary?.passed ?? "?")}/${String(acceptance?.summary?.total ?? 15)}${acceptance?.flaky.length ? `, нестабильны: ${acceptance.flaky.join(", ")}` : ""}`);

  log("скриншоты…");
  const screens = await takeScreenshots({ copyDir, outDir: join(plan.resultDir, "screens") });
  writeFileSync(join(plan.resultDir, "screens.json"), `${JSON.stringify(screens.shots, null, 2)}\n`);

  const usageBefore = state.usageBefore;
  const usageAfter = readUsageWindow({ cwd: RUNS_ROOT });
  log(`окно лимитов после: сессия ${String(usageAfter.sessionPercent)}%, неделя ${String(usageAfter.weekPercent)}%`);

  const leaks = scanLeaks(transcriptText, guardLog);
  if (leaks.leakSuspect) log(`ПОДОЗРЕНИЕ НА УТЕЧКУ: ${JSON.stringify(leaks)}`);

  // Токен не должен остаться ни в логах, ни в результатах.
  const tokenFoundIn = [];
  for (const path of [transcriptPath, stderrPath, join(logDir, "harness.log"), ...listFiles(plan.resultDir).filter((file) => !file.endsWith(".png"))]) {
    if (existsSync(path) && redactFile(path, token)) tokenFoundIn.push(relative(REPO_ROOT, path));
  }
  for (const path of listFiles(plan.resultDir).filter((file) => file.endsWith(".png"))) {
    if (readFileSync(path).includes(Buffer.from(token))) tokenFoundIn.push(relative(REPO_ROOT, path));
  }
  if (tokenFoundIn.length > 0) log(`ТОКЕН НАЙДЕН И УДАЛЁН: ${tokenFoundIn.join(", ")}`);

  writeFileSync(`${transcriptPath}.gz`, gzipSync(readFileSync(transcriptPath)));
  rmSync(transcriptPath);

  const rateLimited = analysis.rateLimits.some((info) => info?.status === "rejected");
  const apiFailure =
    analysis.result?.isError === true &&
    (analysis.result.apiErrorStatus !== null || /limit|rate|overloaded|authentication/i.test(analysis.result.resultText ?? ""));
  const infraError = !analysis.init || analysis.requests === 0 || rateLimited || apiFailure;
  const status = infraError ? "infra_error" : state.agent.timedOut ? "timeout" : "complete";

  const acPassed = acceptance?.summary?.passed ?? 0;
  const protectedViolation = violations.length > 0;
  const acCounted = protectedViolation ? 0 : acPassed;
  const percent = (key) =>
    usageBefore?.[key] !== null && usageBefore?.[key] !== undefined && usageAfter[key] !== null ? usageAfter[key] - usageBefore[key] : null;

  const result = {
    config: { id: config.id, model: config.model, spec: config.spec, contour: config.contour },
    run: plan.run,
    pilot: plan.pilot,
    status,
    startedAt: state.startedAt,
    finishedAt: new Date().toISOString(),
    baseCommit: state.baseCommit,
    claudeCodeVersion: analysis.init?.claudeCodeVersion ?? null,
    modelIds: analysis.modelIds,
    effort: {
      passed: null,
      reportedByCli: null,
      documentedDefaultForModel: DOCUMENTED_DEFAULT_EFFORT[config.model] ?? null,
      note: "--effort не передаётся; CLI 2.1.199 фактическое значение не сообщает",
    },
    limits: { timeMs: options.timeMs, maxTurns: options.maxTurns },
    metrics: {
      wallMs: state.agent.wallMs,
      apiMs: analysis.result?.durationApiMs ?? null,
      turns: analysis.turns,
      requests: analysis.requests,
      terminalReason: state.agent.timedOut ? "harness_timeout" : (analysis.result?.terminalReason ?? null),
      exitCode: state.agent.exitCode,
      blockedCheckAttempts: countLines(blockLog) + countLines(guardLog, (line) => line.includes(" check ")),
      leftoverProcessesKilled: state.killed.length,
    },
    tokens: {
      totals: analysis.totals,
      byModel: analysis.tokensByModel,
      backgroundUsageKnown: analysis.backgroundUsageKnown,
      usageCheck: analysis.usageCheck,
      incompleteRequests: analysis.incompleteRequests,
    },
    costUsd: analysis.totals.costUsd,
    cliCostUsd: analysis.result?.cliCostUsd ?? null,
    prices: { checkedAt: PRICES.checkedAt, source: PRICES.source },
    usageWindow: {
      before: usageBefore,
      after: usageAfter,
      sessionDeltaPercent: sameSessionWindow(usageBefore, usageAfter) ? percent("sessionPercent") : null,
      weekDeltaPercent: percent("weekPercent"),
      note: "Окно общее для подписки: в дельту входят и запросы других сессий за то же время",
    },
    protection: { violation: protectedViolation, files: violations },
    isolation: {
      tools: analysis.init?.tools ?? null,
      mcpServers: analysis.init?.mcpServers ?? null,
      skills: analysis.init?.skills ?? null,
      plugins: analysis.init?.plugins ?? null,
      memoryPaths: analysis.init?.memoryPaths ?? null,
      apiKeySource: analysis.init?.apiKeySource ?? null,
      ...leaks,
      tokenFoundIn,
    },
    artifacts: { hasPlan, diff: diffStat, screens: screens.shots, logsDir: logDir },
    acceptance,
    acPassed,
    acCounted,
    accepted: status !== "infra_error" && acCounted === 15,
    agentResultText: analysis.result?.resultText ?? null,
  };
  writeFileSync(join(plan.resultDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  if (redactFile(join(plan.resultDir, "result.json"), token)) log("ТОКЕН НАЙДЕН И УДАЛЁН в result.json");

  if (!options.keep) {
    rmSync(copyDir, { recursive: true, force: true });
    rmSync(`${copyDir}.json`, { force: true });
  }
  log(`готово: ${status}, AC ${String(acCounted)}/15, $${result.costUsd.toFixed(4)}, результаты: ${relative(REPO_ROOT, plan.resultDir)}`);
  return result;
};

const main = async () => {
  const { values } = parseArgs({
    options: {
      round: { type: "string" },
      only: { type: "string" },
      pilot: { type: "string" },
      "time-limit": { type: "string" },
      "max-turns": { type: "string" },
      keep: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      finish: { type: "string" },
    },
  });
  if (values.finish) {
    const state = readJson(join(values.finish, "state.json"));
    if (!state) throw new Error(`Нет state.json в ${values.finish}`);
    await finishRun(state);
    return;
  }
  const options = {
    timeMs: values["time-limit"] ? parseDuration(values["time-limit"]) : LIMITS.timeMs,
    maxTurns: values["max-turns"] ? Number(values["max-turns"]) : LIMITS.maxTurns,
    keep: values.keep,
  };
  const plans = planRuns(values);
  console.log(`Конфигурации: ${CONFIGS.map((config) => config.id).join(", ")}`);
  for (const plan of plans) {
    const done = !plan.pilot && isDone(plan.resultDir);
    console.log(`${done ? "✓" : "·"} ${plan.config.id} ${plan.label}${done ? " (готов, пропуск)" : ""}`);
  }
  if (values["dry-run"]) return;

  precheck();
  for (const plan of plans) {
    if (!plan.pilot && isDone(plan.resultDir)) continue;
    if (!plan.pilot) moveToAborted(plan.resultDir, plan.config, plan.label);
    if (!isPortFree(AGENT_PORT)) throw new Error(`Порт ${String(AGENT_PORT)} занят перед прогоном ${plan.config.id}`);
    await waitForWindowRoom({ model: plan.config.model, log: (message) => console.log(`  ${message}`) });
    console.log(`▶ ${plan.config.id} ${plan.label}`);
    await runOne(plan, options);
  }
};

await main();
