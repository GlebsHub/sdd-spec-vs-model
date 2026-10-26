import { execFileSync, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { LIMITS, PROMPT } from "../config.mjs";

/** Окружение CLI прогона: подписка через OAuth-токен, чистая папка конфигурации, без API-ключей. */
export const agentEnv = ({ token, configDir }) => {
  const env = { ...process.env };
  for (const name of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"]) {
    delete env[name];
  }
  for (const name of Object.keys(env)) {
    if (name.startsWith("VSCODE_") || name.startsWith("CLAUDE_CODE_SSE")) delete env[name];
  }
  env["CLAUDE_CODE_OAUTH_TOKEN"] = token;
  env["CLAUDE_CONFIG_DIR"] = configDir;
  env["DISABLE_AUTOUPDATER"] = "1";
  return env;
};

/**
 * Загрузка окна лимитов подписки: `/usage` в режиме -p (локальная команда, без запроса к модели).
 * Читается обычным входом пользователя, а не токеном прогона: токен `setup-token` даёт доступ только
 * к вызовам модели, и `/usage` с ним показывает лишь статистику сессии. Окно общее для аккаунта.
 */
export const readUsageWindow = ({ cwd }) => {
  const env = { ...process.env };
  for (const name of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CONFIG_DIR"]) {
    delete env[name];
  }
  try {
    const out = execFileSync("claude", ["-p", "/usage", "--output-format", "json", "--no-session-persistence"], {
      cwd,
      env,
      encoding: "utf8",
      timeout: 60_000,
    });
    const text = String(JSON.parse(out).result ?? "");
    const session = /Current session:\s*(\d+)% used(?:\s*·\s*resets ([^\n]+))?/.exec(text);
    const week = /Current week \(all models\):\s*(\d+)% used/.exec(text);
    return {
      at: new Date().toISOString(),
      sessionPercent: session ? Number(session[1]) : null,
      sessionResets: session?.[2]?.trim() ?? null,
      weekPercent: week ? Number(week[1]) : null,
    };
  } catch (error) {
    return { at: new Date().toISOString(), error: String(error).slice(0, 300) };
  }
};

/**
 * Запускает агента в копии. Лимит времени — по часам харнесса: SIGTERM группе процессов, затем SIGKILL.
 * stdout (stream-json) пишется в transcriptPath; возвращает строки лога и признак таймаута.
 */
export const runAgent = ({ cwd, env, model, settingsPath, transcriptPath, stderrPath, timeMs = LIMITS.timeMs, maxTurns = LIMITS.maxTurns }) =>
  new Promise((resolve) => {
    const args = [
      "-p",
      PROMPT,
      "--model",
      model,
      "--output-format",
      "stream-json",
      "--verbose",
      // Нужен ради message_delta: только там итоговые output_tokens каждого запроса.
      "--include-partial-messages",
      "--max-turns",
      String(maxTurns),
      "--permission-mode",
      "bypassPermissions",
      "--settings",
      settingsPath,
      "--setting-sources",
      "project,local",
      "--strict-mcp-config",
      "--mcp-config",
      JSON.stringify({ mcpServers: {} }),
      "--disable-slash-commands",
      "--no-session-persistence",
    ];
    const startedAt = Date.now();
    const child = spawn("claude", args, { cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    const transcript = createWriteStream(transcriptPath);
    const stderr = createWriteStream(stderrPath);
    const lines = [];
    let buffer = "";
    child.stdout.on("data", (chunk) => {
      transcript.write(chunk);
      buffer += chunk.toString("utf8");
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      lines.push(...parts);
    });
    child.stderr.pipe(stderr);

    let timedOut = false;
    const killGroup = (signal) => {
      try {
        process.kill(-child.pid, signal);
      } catch {
        // Группа уже завершилась.
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup("SIGTERM");
      setTimeout(() => killGroup("SIGKILL"), LIMITS.killGraceMs).unref();
    }, timeMs);

    // Ctrl+C: остановить агента и сообщить вызывающему коду — прогон не засчитывается.
    let interrupted = false;
    const onInterrupt = () => {
      interrupted = true;
      killGroup("SIGKILL");
    };
    process.once("SIGINT", onInterrupt);

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      process.removeListener("SIGINT", onInterrupt);
      if (buffer.trim() !== "") lines.push(buffer);
      transcript.end();
      stderr.end();
      resolve({ lines, exitCode: code, signal, timedOut, interrupted, wallMs: Date.now() - startedAt });
    });
  });

/** Добивает процессы, оставленные агентом: всё, что запущено из папки копии, и слушателей порта агента. */
export const killLeftovers = ({ dir, port }) => {
  const pids = new Set();
  const collect = (command, args) => {
    try {
      for (const pid of execFileSync(command, args, { encoding: "utf8" }).split(/\s+/).filter(Boolean)) {
        pids.add(Number(pid));
      }
    } catch {
      // Ничего не найдено.
    }
  };
  collect("pgrep", ["-f", dir]);
  collect("lsof", ["-ti", `tcp:${String(port)}`, "-sTCP:LISTEN"]);
  pids.delete(process.pid);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Уже завершён.
    }
  }
  return [...pids];
};

export const isPortFree = (port) => {
  try {
    execFileSync("lsof", ["-ti", `tcp:${String(port)}`, "-sTCP:LISTEN"], { encoding: "utf8" });
    return false;
  } catch {
    return true;
  }
};
