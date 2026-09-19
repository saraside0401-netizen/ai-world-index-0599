/**
 * Единый расчётный контур AI WORLD INDEX V1.
 *
 * DATA → VERIFIED → NORMALIZED (утверждённые правила) → INDICATOR SCORE
 * → DIRECTION SCORE → COMPOSITE SCORE → AI WORLD INDEX.
 *
 * Методология, веса направлений и внутренний вес 1/3 не изменяются.
 * Значения не придумываются: без подтверждённых данных или утверждённых
 * правил показатель не участвует в расчёте и не считается нулём.
 */

import { useEffect, useMemo } from "react";
import { useAdminUnlocked } from "./use-admin-gate";
import { computeIndex } from "./index-core";
import { useIndicators } from "./indicators-store";
import { applyApprovedRules, rulesSummary, validatePipeline } from "./normalization-pipeline";
import { useNormalizationRules } from "./normalization-rules";

export function useIndexPipeline() {
  const store = useIndicators();
  /** Запись баллов — операция методолога; публичный посетитель только читает. */
  const adminUnlocked = useAdminUnlocked();
  const rulesState = useNormalizationRules();
  const { indicators } = store;
  const { rules } = rulesState;

  const applied = useMemo(() => applyApprovedRules(indicators, rules), [indicators, rules]);
  const result = useMemo(() => computeIndex(applied), [applied]);

  const indicatorResults = useMemo(
    () => result.directions.flatMap((d) => d.indicators),
    [result],
  );

  const checks = useMemo(
    () =>
      validatePipeline(
        applied,
        result.directions.map((d) => ({ weight: d.weight, score: d.score })),
        indicatorResults.map((r) => r.score),
      ),
    [applied, result, indicatorResults],
  );

  const total = indicators.length;
  const verified = indicators.filter((i) => i.dataStatus === "verified").length;
  const missing = indicators.filter((i) => i.dataStatus === "missing").length;
  const normalized = indicatorResults.filter((r) => r.score !== null).length;
  /** Доля веса показателей (по всем направлениям), обеспеченная баллами. */
  const normalizedCoverage = total > 0 ? normalized / total : 0;

  // Рассчитанные баллы сохраняются в постоянную базу (детерминированно, без выдумок).
  const signature = useMemo(
    () =>
      indicatorResults
        .map((r) => `${r.indicator.id}:${r.score ?? "n"}:${r.contribution ?? "n"}`)
        .join("|"),
    [indicatorResults],
  );

  useEffect(() => {
    if (!adminUnlocked) return;
    if (!store.hydrated || !rulesState.hydrated || indicatorResults.length === 0) return;
    void store.persistScores(
      indicatorResults.map((r) => ({
        id: r.indicator.id,
        score: r.score,
        contribution: r.contribution,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, store.hydrated, rulesState.hydrated, adminUnlocked]);

  return {
    ...store,
    rules,
    rulesHydrated: rulesState.hydrated,
    updateRule: rulesState.updateRule,
    rulesSummary: rulesSummary(rules),
    applied,
    result,
    checks,
    counts: { total, verified, missing, normalized, normalizedCoverage },
  };
}
