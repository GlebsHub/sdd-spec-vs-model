import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "../lib/make-copy.mjs";

/** База заморожена (CLAUDE.md в корне). Прогоны на другой базе несравнимы. */
export const BASE_COMMIT = "541a56ff5977f131027cbcab71059da0ad1fcb21";

export const MODELS = {
  haiku: "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
};

/** Значения effort по умолчанию по документации API; CLI 2.1.199 фактическое значение не сообщает. */
export const DOCUMENTED_DEFAULT_EFFORT = {
  [MODELS.haiku]: "medium",
  [MODELS.sonnet]: "high",
};

export const CONFIGS = [
  { id: "H-brief-off", model: MODELS.haiku, spec: "brief", contour: false },
  { id: "H-full-off", model: MODELS.haiku, spec: "full", contour: false },
  { id: "H-brief-on", model: MODELS.haiku, spec: "brief", contour: true },
  { id: "H-full-on", model: MODELS.haiku, spec: "full", contour: true },
  { id: "S-full-off", model: MODELS.sonnet, spec: "full", contour: false },
  // Добавлена после круга 1 (23.10.2026): её прогон 1 — отдельно перед кругом 2.
  { id: "S-brief-off", model: MODELS.sonnet, spec: "brief", contour: false },
];

export const RUNS_PER_CONFIG = 3;

/** Повторы приёмки на прогон; AC засчитан по большинству (lib/score.mjs). */
export const ACCEPTANCE_REPEAT = 3;

export const PROMPT = "Реализуй SPEC.md, следуя CLAUDE.md";

export const LIMITS = {
  /** Время работы агента. */
  timeMs: 25 * 60 * 1000,
  /** Страховка от зацикливания; основной лимит — время. */
  maxTurns: 300,
  /** Между SIGTERM и SIGKILL. */
  killGraceMs: 10_000,
};

/**
 * Ограничитель окна подписки: перед прогоном `/usage`; если окно + ожидаемый расход > maxPercent — ждём сброса.
 * Ожидаемый расход — с запасом к кругу 1: Haiku 5–7 п.п. окна, Sonnet 26.
 */
export const WINDOW_GUARD = {
  maxPercent: 95,
  expectedPercent: {
    [MODELS.haiku]: { session: 10, week: 1 },
    [MODELS.sonnet]: { session: 30, week: 3 },
  },
  afterResetMs: 2 * 60_000,
  /** Интервал перепроверки, если время сброса не распознано. */
  pollMs: 10 * 60_000,
  /** `/usage` показывает время сброса то 15:39, то 15:40. */
  sameWindowToleranceMs: 5 * 60_000,
};

/** Порт dev-сервера агента зашит в защищённые vite.config.ts и playwright.config.ts. */
export const AGENT_PORT = 5173;

/** Токен `claude setup-token`. Хранится вне репозитория. */
export const TOKEN_FILE = process.env["SDD_EVAL_TOKEN_FILE"] ?? join(homedir(), ".config", "sdd-eval", "claude-oauth-token");

/** Копии для прогонов: отдельно от копий эталона (`$TMPDIR/sdd-eval/`). */
export const RUNS_ROOT = join(tmpdir(), "sdd-eval-runs");
/** Копии эталона и голой базы — их харнесс удаляет перед прогонами, чтобы агент не мог их найти. */
export const REFERENCE_COPIES_ROOT = join(tmpdir(), "sdd-eval");
/** Логи и служебные файлы прогонов — вне репозитория. */
export const LOGS_ROOT = process.env["SDD_EVAL_LOGS"] ?? join(homedir(), ".local", "share", "sdd-eval", "runs");

export const RESULTS_DIR = join(REPO_ROOT, "eval", "results");
export const ACCEPTANCE_RUNNER = join(REPO_ROOT, "eval", "acceptance", "run.mjs");

/** Круг k начинается с k-й конфигурации: время суток не совпадает с конфигурацией. */
export const configsForRound = (round) => {
  const shift = (round - 1) % CONFIGS.length;
  return [...CONFIGS.slice(shift), ...CONFIGS.slice(0, shift)];
};

export const findConfig = (id) => {
  const config = CONFIGS.find((item) => item.id === id);
  if (!config) {
    throw new Error(`Unknown config "${id}", expected: ${CONFIGS.map((item) => item.id).join(", ")}`);
  }
  return config;
};
