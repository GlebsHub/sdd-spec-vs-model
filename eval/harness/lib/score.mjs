import { ACCEPTANCE_REPEAT } from "../config.mjs";

export const ACCEPTANCE_RULE = `критерий засчитан, если прошёл в большинстве из ${String(ACCEPTANCE_REPEAT)} повторов приёмки`;

/** Аргументы раннера приёмки для прогона и переоценки. */
export const acceptanceArgs = (runner, copyDir, outPath) => [runner, copyDir, "--out", outPath, "--repeat", String(ACCEPTANCE_REPEAT)];

/**
 * Оценка по большинству повторов. Раннер сам засчитывает критерий, только если тот прошёл во всех повторах
 * (так валидируется эталон); для кода агента это наказывало бы и за редкие сбои стенда, а один повтор
 * давал бы результат, зависящий от случая. Причина берётся из упавшего повтора.
 */
export const scoreAcceptance = (acceptance) => {
  if (!acceptance?.criteria) return null;
  const ids = Object.keys(acceptance.criteria);
  const runs = acceptance.perRun ?? [{ failed: ids.filter((id) => acceptance.criteria[id].status !== "passed") }];
  const criteria = Object.fromEntries(
    ids.map((id) => {
      const passes = runs.filter((run) => !run.failed.includes(id)).length;
      const status = passes * 2 > runs.length ? "passed" : "failed";
      const reason = passes < runs.length ? (acceptance.criteria[id].reason ?? null) : null;
      return [id, { status, passes, repeats: runs.length, reason }];
    }),
  );
  const passed = ids.filter((id) => criteria[id].status === "passed").length;
  return {
    rule: ACCEPTANCE_RULE,
    summary: { passed, failed: ids.length - passed, total: ids.length },
    flaky: ids.filter((id) => criteria[id].passes > 0 && criteria[id].passes < runs.length),
    criteria,
  };
};
