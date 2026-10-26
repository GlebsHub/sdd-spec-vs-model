import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PRICES = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "prices.json"), "utf8"));

const PER_TOKEN = 1 / 1_000_000;

const priceFor = (model, promptTokens) => {
  const key = Object.keys(PRICES.models).find((name) => model === name || model.startsWith(`${name}-`));
  if (!key) {
    throw new Error(`No price for model "${model}" in prices.json`);
  }
  const base = PRICES.models[key];
  return base.longContext && promptTokens > base.longContext.thresholdTokens ? base.longContext : base;
};

/**
 * Стоимость одного запроса по usage из ответа API.
 * Запись кэша делится на 5 мин и 1 ч, если API прислал разбивку; иначе считается по 1 ч (так пишет Claude Code).
 */
export const requestCost = (model, usage) => {
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const write5m = usage.cache_creation?.ephemeral_5m_input_tokens;
  const write1h = usage.cache_creation?.ephemeral_1h_input_tokens;
  const split = write5m !== undefined || write1h !== undefined;
  const price = priceFor(model, input + cacheRead + cacheWrite);
  return (
    PER_TOKEN *
    (input * price.input +
      output * price.output +
      cacheRead * price.cacheRead +
      (split ? (write5m ?? 0) * price.cacheWrite5m + (write1h ?? 0) * price.cacheWrite1h : cacheWrite * price.cacheWrite1h))
  );
};

/** Стоимость по агрегату modelUsage из события result (для фоновой модели: тарифы без разбивки кэша). */
export const aggregateCost = (model, usage) =>
  PER_TOKEN *
  (() => {
    const price = priceFor(model, 0);
    return (
      (usage.inputTokens ?? 0) * price.input +
      (usage.outputTokens ?? 0) * price.output +
      (usage.cacheReadInputTokens ?? 0) * price.cacheRead +
      (usage.cacheCreationInputTokens ?? 0) * price.cacheWrite1h
    );
  })();
