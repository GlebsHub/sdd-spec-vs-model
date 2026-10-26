import { aggregateCost, requestCost } from "./cost.mjs";

const emptyTokens = () => ({ requests: 0, input: 0, output: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, costUsd: 0 });

/**
 * Разбор stream-json лога Claude Code (с --include-partial-messages).
 * Usage каждого запроса — из stream_event message_start + message_delta: в событиях assistant
 * output_tokens фиксируется в начале ответа и занижен. Если message_delta нет (ответ оборван),
 * берётся usage из assistant и запрос помечается как неполный. Фоновая модель, которой нет
 * в событиях потока, — из modelUsage финального события result.
 */
export const analyzeTranscript = (lines) => {
  const events = [];
  for (const line of lines) {
    if (line.trim() === "") continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // Обрезанная строка при остановке по таймауту.
    }
  }

  const init = events.find((event) => event.type === "system" && event.subtype === "init");
  const result = events.findLast((event) => event.type === "result");
  const rateLimits = events.filter((event) => event.type === "rate_limit_event").map((event) => event.rate_limit_info);

  const messages = new Map();
  const currentByStream = new Map();
  for (const event of events) {
    if (event.type === "stream_event") {
      const stream = event.parent_tool_use_id ?? "main";
      if (event.event?.type === "message_start" && event.event.message?.id) {
        const { id, model, usage } = event.event.message;
        currentByStream.set(stream, id);
        messages.set(id, { model, usage: usage ?? {}, final: false, hasToolUse: messages.get(id)?.hasToolUse ?? false });
      } else if (event.event?.type === "message_delta") {
        const id = currentByStream.get(stream);
        const message = id ? messages.get(id) : undefined;
        if (message) {
          message.usage = { ...message.usage, ...event.event.usage };
          message.final = true;
        }
      }
    } else if (event.type === "assistant" && event.message?.id) {
      const previous = messages.get(event.message.id);
      const hasToolUse = Boolean(previous?.hasToolUse) || (event.message.content ?? []).some((block) => block.type === "tool_use");
      if (previous) {
        previous.hasToolUse = hasToolUse;
      } else {
        messages.set(event.message.id, { model: event.message.model, usage: event.message.usage ?? {}, final: false, hasToolUse });
      }
    }
  }
  const incompleteRequests = [...messages.values()].filter((message) => !message.final).length;

  const byModel = {};
  for (const { model, usage } of messages.values()) {
    const tokens = (byModel[model] ??= emptyTokens());
    tokens.requests += 1;
    tokens.input += usage.input_tokens ?? 0;
    tokens.output += usage.output_tokens ?? 0;
    tokens.cacheRead += usage.cache_read_input_tokens ?? 0;
    const split = usage.cache_creation;
    if (split) {
      tokens.cacheWrite5m += split.ephemeral_5m_input_tokens ?? 0;
      tokens.cacheWrite1h += split.ephemeral_1h_input_tokens ?? 0;
    } else {
      tokens.cacheWrite1h += usage.cache_creation_input_tokens ?? 0;
    }
    tokens.costUsd += requestCost(model, usage);
  }

  // Модели, которых нет в событиях assistant (фоновые запросы CLI), — по агрегату result.modelUsage.
  let backgroundUsageKnown = true;
  if (result?.modelUsage) {
    for (const [model, usage] of Object.entries(result.modelUsage)) {
      if (byModel[model]) continue;
      byModel[model] = {
        ...emptyTokens(),
        input: usage.inputTokens ?? 0,
        output: usage.outputTokens ?? 0,
        cacheRead: usage.cacheReadInputTokens ?? 0,
        cacheWrite1h: usage.cacheCreationInputTokens ?? 0,
        costUsd: aggregateCost(model, usage),
        background: true,
      };
    }
  } else {
    backgroundUsageKnown = false;
  }

  const totals = Object.values(byModel).reduce(
    (sum, tokens) => ({
      input: sum.input + tokens.input,
      output: sum.output + tokens.output,
      cacheWrite: sum.cacheWrite + tokens.cacheWrite5m + tokens.cacheWrite1h,
      cacheRead: sum.cacheRead + tokens.cacheRead,
      costUsd: sum.costUsd + tokens.costUsd,
    }),
    { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, costUsd: 0 },
  );

  // Сверка: токены основных моделей из событий assistant против итогового modelUsage CLI.
  const usageCheck = {};
  for (const [model, usage] of Object.entries(result?.modelUsage ?? {})) {
    const tokens = byModel[model];
    if (tokens && !tokens.background) {
      usageCheck[model] = {
        inputDiff: tokens.input - (usage.inputTokens ?? 0),
        outputDiff: tokens.output - (usage.outputTokens ?? 0),
        cacheReadDiff: tokens.cacheRead - (usage.cacheReadInputTokens ?? 0),
        cacheWriteDiff: tokens.cacheWrite5m + tokens.cacheWrite1h - (usage.cacheCreationInputTokens ?? 0),
      };
    }
  }

  const turnsFromMessages = [...messages.values()].filter((message) => message.hasToolUse).length;

  return {
    init: init
      ? {
          model: init.model,
          claudeCodeVersion: init.claude_code_version,
          permissionMode: init.permissionMode,
          apiKeySource: init.apiKeySource,
          tools: init.tools,
          mcpServers: init.mcp_servers,
          skills: init.skills,
          plugins: init.plugins,
          slashCommands: init.slash_commands,
          memoryPaths: init.memory_paths,
          agents: init.agents,
        }
      : null,
    result: result
      ? {
          subtype: result.subtype,
          isError: result.is_error,
          apiErrorStatus: result.api_error_status ?? null,
          terminalReason: result.terminal_reason ?? null,
          numTurns: result.num_turns,
          durationMs: result.duration_ms,
          durationApiMs: result.duration_api_ms,
          cliCostUsd: result.total_cost_usd,
          resultText: typeof result.result === "string" ? result.result.slice(0, 2000) : null,
        }
      : null,
    rateLimits,
    modelIds: Object.keys(byModel),
    tokensByModel: byModel,
    totals,
    backgroundUsageKnown,
    usageCheck,
    /** Запросы без message_delta: их output_tokens занижен (оборванный ответ или лог без partial messages). */
    incompleteRequests,
    turns: result?.num_turns ?? turnsFromMessages,
    requests: messages.size,
  };
};
