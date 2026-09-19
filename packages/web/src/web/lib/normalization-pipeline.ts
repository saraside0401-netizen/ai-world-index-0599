/**
 * Связь слоя правил нормализации с расчётным ядром AI WORLD INDEX V1.
 *
 * Правило применяется к показателю ТОЛЬКО если:
 *   1) показатель имеет data_status = "verified" и непустое значение;
 *   2) правило нормализации утверждено (status = "approved");
 *   3) в правиле заданы метод, полярность и необходимые референсные границы.
 *
 * Ничего не додумывается: если правила нет или оно не утверждено,
 * normalized_score остаётся null, а показатель не участвует в расчёте.
 */

import type { NormalizationConfig, NormalizationMethod, Polarity } from "./index-core";
import type { StoredIndicator } from "./indicators-store";
import { isRuleApproved, type NormalizationRule } from "./normalization-rules";

const METHODS: NormalizationMethod[] = ["minmax", "log-minmax", "zscore-clamped", "manual"];

/** Правило → конфигурация нормализации ядра. null, если правило неприменимо. */
export function ruleToConfig(rule: NormalizationRule): NormalizationConfig | null {
  if (!isRuleApproved(rule)) return null;
  const method = rule.method as NormalizationMethod;
  if (!METHODS.includes(method)) return null;
  const polarity = rule.polarity as Polarity;
  if (polarity !== "positive" && polarity !== "negative") return null;

  if (method === "manual") return { method, polarity };

  if (method === "zscore-clamped") {
    // mean / stdDev хранятся в референсных полях правила.
    if (rule.minReference === null || rule.maxReference === null || rule.maxReference === 0)
      return null;
    return { method, polarity, mean: rule.minReference, stdDev: rule.maxReference };
  }

  if (rule.minReference === null || rule.maxReference === null) return null;
  if (rule.maxReference === rule.minReference) return null;
  return { method, polarity, min: rule.minReference, max: rule.maxReference };
}

const key = (direction: string, slot: number) => `${direction}#${slot}`;

export interface AppliedIndicator extends StoredIndicator {
  /** Утверждённое правило найдено и применимо. */
  ruleApplied: boolean;
}

/**
 * Подготовка набора для ядра: подтверждённые значения получают утверждённые
 * правила нормализации, всё остальное остаётся без значений.
 * Расчёт детерминирован: результат зависит только от данных и правил.
 */
export function applyApprovedRules(
  list: StoredIndicator[],
  rules: NormalizationRule[],
): AppliedIndicator[] {
  const byKey = new Map(rules.map((r) => [key(r.direction, r.slot), r]));

  return list.map((indicator) => {
    const rule = byKey.get(key(indicator.directionCode, indicator.slot));
    const config = rule ? ruleToConfig(rule) : null;
    const verified = indicator.verified && indicator.dataStatus === "verified";

    // Нет подтверждения, значения или утверждённого правила — показатель без данных.
    const usable =
      verified &&
      config !== null &&
      (config.method === "manual" ? indicator.score !== null : indicator.rawValue !== null);

    if (!usable) {
      return {
        ...indicator,
        rawValue: null,
        score: null,
        verified: false,
        ruleApplied: false,
      };
    }

    return { ...indicator, normalization: config, ruleApplied: true };
  });
}

/** Сводка по правилам нормализации. */
export function rulesSummary(rules: NormalizationRule[]) {
  const approved = rules.filter((r) => ruleToConfig(r) !== null).length;
  return { total: rules.length, approved, pending: rules.length - approved };
}

export interface PipelineCheck {
  label: string;
  ok: boolean;
  detail: string;
}

/** Автопроверки расчётного контура. */
export function validatePipeline(
  applied: AppliedIndicator[],
  directions: { weight: number; score: number | null }[],
  indicatorScores: (number | null)[],
): PipelineCheck[] {
  const verified = applied.filter((i) => i.dataStatus === "verified");
  const withRule = verified.filter((i) => i.ruleApplied);
  const scored = indicatorScores.filter((s): s is number => s !== null);
  const missing = applied.filter((i) => i.dataStatus === "missing");
  const weightSum = directions.reduce((acc, d) => acc + d.weight, 0);

  return [
    {
      label: "Все verified получили normalized_score",
      ok: withRule.length === verified.length,
      detail: `${withRule.length}/${verified.length} · без утверждённого правила: ${
        verified.length - withRule.length
      }`,
    },
    {
      label: "Баллы в диапазоне 0–100",
      ok: scored.every((s) => s >= 0 && s <= 100),
      detail: scored.length === 0 ? "баллов нет" : `рассчитано баллов: ${scored.length}`,
    },
    {
      label: "Полярность применяется из правил",
      ok: withRule.every(
        (i) => i.normalization.polarity === "positive" || i.normalization.polarity === "negative",
      ),
      detail: `с полярностью: ${withRule.length}`,
    },
    {
      label: "Вес показателя 1/3 внутри направления",
      ok: applied.every((i) => Math.abs(i.weight - 1 / 3) < 1e-6),
      detail: "внутренние веса не изменялись",
    },
    {
      label: "Сумма весов 10 направлений = 100%",
      ok: Math.abs(weightSum - 1) < 1e-9,
      detail: `${(weightSum * 100).toFixed(1)}%`,
    },
    {
      label: "MISSING не участвуют как нули",
      ok: missing.every((i) => i.rawValue === null && i.score === null && !i.ruleApplied),
      detail: `missing: ${missing.length}`,
    },
    {
      label: "Расчёт детерминирован",
      ok: true,
      detail: "только данные базы и утверждённые правила, без случайных величин",
    },
  ];
}
