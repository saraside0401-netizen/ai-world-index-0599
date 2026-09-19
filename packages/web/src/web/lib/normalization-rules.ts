/**
 * Слой правил нормализации AI WORLD INDEX V1.
 *
 * Таблица `normalization_rules` хранит по одной записи на каждый из 30
 * утверждённых показателей и читается через oRPC (`api/routes/rules.ts`).
 * Референсные границы и метод НЕ придумываются: пока правило не утверждено
 * методологией, статус остаётся "pending", а normalized_score показателя
 * остаётся null.
 *
 * Отличие от исходной версии проекта только в транспорте: прямые обращения
 * браузера к базе заменены типизированными процедурами oRPC.
 */

import { useCallback } from "react";
import type { NormalizationRuleRow } from "../../api/database/schema";
import { useRulesQuery, useUpdateRule } from "../queries/rules";

export type NormalizationRule = {
  id: string;
  direction: string;
  slot: number;
  indicatorName: string;
  method: string;
  minReference: number | null;
  maxReference: number | null;
  polarity: string;
  status: string;
  note: string;
  referenceDataset: string;
  referenceSourceUrl: string;
  boundsRule: string;
};

/** Правило V1.0 для референсных границ: L = P2.5, U = P97.5. */
export const BOUNDS_RULE_V1 = "L = P2.5, U = P97.5";

/** Правило считается применимым только при статусе "approved". */
export const isRuleApproved = (rule: NormalizationRule) => rule.status === "approved";

function rowToRule(row: NormalizationRuleRow): NormalizationRule {
  return {
    id: row.id,
    direction: row.direction,
    slot: row.slot,
    indicatorName: row.indicatorName,
    method: row.normalizationMethod,
    minReference: row.minReference,
    maxReference: row.maxReference,
    polarity: row.polarity,
    status: row.status || "pending",
    note: row.note,
    referenceDataset: row.referenceDataset,
    referenceSourceUrl: row.referenceSourceUrl,
    boundsRule: row.boundsRule || BOUNDS_RULE_V1,
  };
}

export function useNormalizationRules() {
  const query = useRulesQuery();
  const { mutateAsync } = useUpdateRule();

  const rules: NormalizationRule[] = (query.data ?? []).map(rowToRule);
  const hydrated = query.isFetched;

  /** Правка правила методологом: метод, референсные границы, полярность, статус. */
  const updateRule = useCallback(
    async (id: string, patch: Partial<Omit<NormalizationRule, "id" | "direction" | "slot">>) => {
      await mutateAsync({
        id,
        patch: {
          ...(patch.method !== undefined ? { method: patch.method } : {}),
          ...(patch.minReference !== undefined ? { minReference: patch.minReference } : {}),
          ...(patch.maxReference !== undefined ? { maxReference: patch.maxReference } : {}),
          ...(patch.polarity !== undefined ? { polarity: patch.polarity } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
          ...(patch.referenceDataset !== undefined
            ? { referenceDataset: patch.referenceDataset }
            : {}),
          ...(patch.referenceSourceUrl !== undefined
            ? { referenceSourceUrl: patch.referenceSourceUrl }
            : {}),
          ...(patch.boundsRule !== undefined ? { boundsRule: patch.boundsRule } : {}),
          ...(patch.indicatorName !== undefined ? { indicatorName: patch.indicatorName } : {}),
        },
      });
    },
    [mutateAsync],
  );

  const approved = rules.filter(isRuleApproved).length;

  return {
    rules,
    hydrated,
    approved,
    pending: rules.length - approved,
    reload: query.refetch,
    updateRule,
  };
}
