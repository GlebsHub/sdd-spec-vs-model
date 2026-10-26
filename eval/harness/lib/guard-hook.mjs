#!/usr/bin/env node
/**
 * PreToolUse-хук прогона (копируется в служебную папку прогона, вне копии и репозитория).
 * Аргументы: <журнал> <contour:on|off> <запрещённые пути через \n в base64>.
 * - Bash-команды, упоминающие запрещённые пути (репозиторий стенда, копии эталона), отклоняются всегда.
 * - В «без контура» отклоняются запуски автоматических проверок.
 */
import { appendFileSync, readFileSync } from "node:fs";

const [logPath, contour, forbiddenB64] = process.argv.slice(2);
const forbidden = Buffer.from(forbiddenB64 ?? "", "base64").toString("utf8").split("\n").filter(Boolean);
const input = JSON.parse(readFileSync(0, "utf8"));
const command = String(input?.tool_input?.command ?? "");

const CHECKS =
  /(^|[\s;&|(`'"/])(tsc|eslint|vitest|playwright)(\s|$|['"`;&|)])|npm\s+(run\s+)?(check|test|lint|typecheck|test:e2e)\b|node_modules\/(typescript|eslint|vitest|@playwright|playwright)\//;

const deny = (kind, reason) => {
  appendFileSync(logPath, `${new Date().toISOString()} ${kind} ${JSON.stringify(command)}\n`);
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
    }),
  );
  process.exit(0);
};

if (forbidden.some((path) => command.includes(path))) {
  deny("forbidden-path", "Доступ к этому пути запрещён.");
}
if (contour === "off" && CHECKS.test(command)) {
  deny("check", "Команда недоступна в этой конфигурации.");
}
process.exit(0);
