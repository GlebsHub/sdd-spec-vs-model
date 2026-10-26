#!/usr/bin/env node
/**
 * Сводка по конфигурациям: eval/results/summary.json и summary.md.
 * Учитываются прогоны со статусом complete или timeout (без _pilot и _aborted); работает на любом числе кругов.
 *
 *   node eval/harness/summarize.mjs
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIGS, RESULTS_DIR, RUNS_PER_CONFIG } from "./config.mjs";
import { PRICES } from "./lib/cost.mjs";

const AC_IDS = Array.from({ length: 15 }, (_, index) => `AC-${String(index + 1).padStart(2, "0")}`);
const COUNTED = new Set(["complete", "timeout"]);

const mean = (values) => (values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length);
const stdev = (values) => {
  const average = mean(values);
  return values.length < 2 || average === null
    ? null
    : Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
};

const loadRuns = (configId) => {
  const dir = join(RESULTS_DIR, configId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^\d+$/.test(name))
    .map((name) => join(dir, name, "result.json"))
    .filter(existsSync)
    .map((path) => JSON.parse(readFileSync(path, "utf8")))
    .filter((result) => COUNTED.has(result.status))
    .sort((a, b) => a.run - b.run);
};

const summarizeConfig = (config) => {
  const runs = loadRuns(config.id);
  const shares = runs.map((run) => run.acCounted / 15);
  const costs = runs.map((run) => run.costUsd);
  const totalCost = costs.reduce((sum, cost) => sum + cost, 0);
  const accepted = runs.filter((run) => run.accepted).length;
  const acDone = runs.reduce((sum, run) => sum + run.acCounted, 0);
  const tokens = (key) => mean(runs.map((run) => run.tokens.totals[key]));
  const background = mean(
    runs.map((run) =>
      Object.values(run.tokens.byModel)
        .filter((model) => model.background)
        .reduce((sum, model) => sum + model.costUsd, 0),
    ),
  );
  return {
    id: config.id,
    model: config.model,
    spec: config.spec,
    contour: config.contour,
    runs: runs.length,
    incomplete: runs.length < RUNS_PER_CONFIG,
    runIds: runs.map((run) => run.run),
    acShare: { mean: mean(shares), min: shares.length ? Math.min(...shares) : null, max: shares.length ? Math.max(...shares) : null, stdev: stdev(shares) },
    acPerRun: runs.map((run) => run.acCounted),
    /** Критерии, разошедшиеся между повторами приёмки, по прогонам. */
    flakyPerRun: runs.map((run) => run.acceptance?.flaky ?? []),
    accepted,
    protectionViolations: runs.filter((run) => run.protection.violation).length,
    timeouts: runs.filter((run) => run.status === "timeout").length,
    leakSuspects: runs.filter((run) => run.isolation.leakSuspect).length,
    tokensMean: { input: tokens("input"), output: tokens("output"), cacheWrite: tokens("cacheWrite"), cacheRead: tokens("cacheRead") },
    wallMinutesMean: mean(runs.map((run) => run.metrics.wallMs / 60000)),
    turnsMean: mean(runs.map((run) => run.metrics.turns)),
    blockedCheckAttemptsMean: mean(runs.map((run) => run.metrics.blockedCheckAttempts)),
    costUsd: { meanPerRun: mean(costs), total: totalCost, backgroundMeanPerRun: background },
    /** Сумма стоимости всех прогонов / число принятых (15/15 без нарушения защиты). */
    costPerAcceptedUsd: accepted > 0 ? totalCost / accepted : null,
    /** Сумма стоимости всех прогонов / сумма выполненных AC (нарушение защиты = 0 AC). */
    costPerAcUsd: acDone > 0 ? totalCost / acDone : null,
    acPassRate: Object.fromEntries(
      AC_IDS.map((id) => [
        id,
        runs.length === 0 ? null : runs.filter((run) => !run.protection.violation && run.acceptance?.criteria?.[id]?.status === "passed").length / runs.length,
      ]),
    ),
  };
};

const fmt = (value, digits = 2) => (value === null || value === undefined ? "—" : value.toFixed(digits));
const pct = (value) => (value === null || value === undefined ? "—" : `${Math.round(value * 100)}%`);
const usd = (value) => (value === null || value === undefined ? "—" : `$${value < 0.1 ? value.toFixed(4) : value.toFixed(2)}`);
const thousands = (value) => (value === null || value === undefined ? "—" : `${Math.round(value / 1000)}k`);

const toMarkdown = (summary) => {
  const rows = summary.configs;
  const lines = [
    "# Сводка прогонов",
    "",
    `Сформировано: ${summary.generatedAt}. Цены: ${summary.prices.source} (проверено ${summary.prices.checkedAt}). Учитываются прогоны complete и timeout.`,
    "",
    "| Конфигурация | Прогонов | Доля AC (среднее) | Мин–макс | σ | Принято | Время, мин | Ходы | Вход | Выход | Запись кэша | Чтение кэша | Стоимость прогона | Стоимость принятого | Стоимость AC |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((row) =>
      [
        `${row.id}${row.incomplete ? " *" : ""}`,
        row.runs,
        pct(row.acShare.mean),
        `${pct(row.acShare.min)}–${pct(row.acShare.max)}`,
        fmt(row.acShare.stdev),
        `${String(row.accepted)}/${String(row.runs)}`,
        fmt(row.wallMinutesMean, 1),
        fmt(row.turnsMean, 0),
        thousands(row.tokensMean.input),
        thousands(row.tokensMean.output),
        thousands(row.tokensMean.cacheWrite),
        thousands(row.tokensMean.cacheRead),
        usd(row.costUsd.meanPerRun),
        usd(row.costPerAcceptedUsd),
        usd(row.costPerAcUsd),
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    ),
    "",
    `\\* меньше ${String(RUNS_PER_CONFIG)} прогонов.`,
    "",
    "- **Доля AC** — выполненные критерии / 15; прогон с нарушением защищённых файлов считается за 0.",
    "- **Стоимость принятого** — сумма условной стоимости всех прогонов конфигурации / число прогонов с 15/15 без нарушения защиты; «—», если таких нет.",
    "- **AC прогона** засчитан, если прошёл в большинстве (2 из 3) повторов приёмки; «Нестабильные AC» — разошедшиеся между повторами.",
    "- **Стоимость AC** — сумма условной стоимости всех прогонов / сумма выполненных AC.",
    "- Условная стоимость — токены из лога × публичные цены API; подписка по токенам не тарифицируется.",
    "",
    "## Прохождение критериев",
    "",
    `| AC | ${rows.map((row) => row.id).join(" | ")} |`,
    `|---|${rows.map(() => "---").join("|")}|`,
    ...AC_IDS.map((id) => `| ${id} | ${rows.map((row) => pct(row.acPassRate[id])).join(" | ")} |`),
    "",
    "## Прочее",
    "",
    "| Конфигурация | AC по прогонам | Нестабильные AC (по прогонам) | Таймауты | Нарушения защиты | Подозрения на утечку | Попыток запустить проверки (среднее) | Фоновая модель, $ / прогон |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map(
      (row) =>
        `| ${row.id} | ${row.acPerRun.join(", ") || "—"} | ${row.flakyPerRun.map((ids) => ids.join(" ") || "—").join("; ") || "—"} | ${String(row.timeouts)} | ${String(row.protectionViolations)} | ${String(row.leakSuspects)} | ${fmt(row.blockedCheckAttemptsMean, 1)} | ${usd(row.costUsd.backgroundMeanPerRun)} |`,
    ),
    "",
  ];
  return lines.join("\n");
};

const summary = {
  generatedAt: new Date().toISOString(),
  prices: { source: PRICES.source, checkedAt: PRICES.checkedAt },
  configs: CONFIGS.map(summarizeConfig),
};
writeFileSync(join(RESULTS_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(join(RESULTS_DIR, "summary.md"), toMarkdown(summary));
console.log(toMarkdown(summary));
