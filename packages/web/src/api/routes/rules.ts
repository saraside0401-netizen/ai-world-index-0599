/**
 * AI WORLD INDEX V1 — API правил нормализации (таблица `normalization_rules`).
 *
 * Перенос слоя доступа к данным из исходного проекта `normalization-rules.ts`:
 * обращение к базе из браузера заменено на oRPC.
 *
 * Правило применяется к расчёту ТОЛЬКО при status = "approved".
 * Метод, референсные границы L/U и полярность не придумываются и не
 * подставляются автоматически: они приходят только от методолога.
 */

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { base } from "../__core/app";
import { adminBase } from "./admin";
import { db } from "../database";
import { BOUNDS_RULE_DEFAULT, normalizationRules } from "../database/schema";

/** Правило V1.0 для референсных границ: L = P2.5, U = P97.5. */
export const BOUNDS_RULE_V1 = BOUNDS_RULE_DEFAULT;

/**
 * Правка правила методологом: метод, референсные границы, полярность, статус.
 * Передаются только изменяемые поля; direction и slot не редактируются —
 * каркас 10 × 3 зафиксирован методологией.
 */
const patchSchema = z.object({
  indicatorName: z.string().optional(),
  method: z.string().optional(),
  minReference: z.number().nullable().optional(),
  maxReference: z.number().nullable().optional(),
  polarity: z.string().optional(),
  status: z.string().optional(),
  note: z.string().optional(),
  referenceDataset: z.string().optional(),
  referenceSourceUrl: z.string().optional(),
  boundsRule: z.string().optional(),
});

/**
 * Перцентиль по правилу V1.0 (линейная интерполяция между порядковыми
 * статистиками). Детерминированно: одинаковый набор — одинаковая граница.
 * Наблюдения приходят от методолога из reference dataset; ничего не
 * достраивается и не экстраполируется.
 */
export function percentile(values: number[], p: number): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0] ?? null;

  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const lowValue = sorted[low];
  const highValue = sorted[high];
  if (lowValue === undefined || highValue === undefined) return null;
  if (low === high) return lowValue;
  return lowValue + (highValue - lowValue) * (rank - low);
}

export const rules = {
  /** Все 30 правил, упорядоченные по направлению и слоту. */
  list: base.handler(() =>
    db
      .select()
      .from(normalizationRules)
      .orderBy(asc(normalizationRules.direction), asc(normalizationRules.slot)),
  ),

  update: adminBase
    .input(z.object({ id: z.string(), patch: patchSchema }))
    .handler(async ({ input }) => {
      const { patch } = input;
      const row: Record<string, unknown> = { updatedAt: new Date().toISOString() };

      if (patch.method !== undefined) row["normalizationMethod"] = patch.method;
      if (patch.minReference !== undefined) row["minReference"] = patch.minReference;
      if (patch.maxReference !== undefined) row["maxReference"] = patch.maxReference;
      if (patch.polarity !== undefined) row["polarity"] = patch.polarity;
      if (patch.status !== undefined) row["status"] = patch.status || "pending";
      if (patch.note !== undefined) row["note"] = patch.note;
      if (patch.referenceDataset !== undefined) row["referenceDataset"] = patch.referenceDataset;
      if (patch.referenceSourceUrl !== undefined)
        row["referenceSourceUrl"] = patch.referenceSourceUrl;
      if (patch.boundsRule !== undefined) row["boundsRule"] = patch.boundsRule || BOUNDS_RULE_V1;
      if (patch.indicatorName !== undefined) row["indicatorName"] = patch.indicatorName;

      const [updated] = await db
        .update(normalizationRules)
        .set(row)
        .where(eq(normalizationRules.id, input.id))
        .returning();
      return updated ?? null;
    }),

  /**
   * Расчёт референсных границ по правилу V1.0: L = P2.5, U = P97.5
   * от reference dataset, который вносит методолог.
   *
   * Границы не выдумываются: они выводятся из переданных наблюдений
   * детерминированным перцентилем. Набор наблюдений и ссылка на источник
   * сохраняются в правиле, чтобы расчёт был воспроизводим.
   * Статус правила не меняется — утверждение остаётся отдельным действием.
   */
  computeBounds: adminBase
    .input(
      z.object({
        id: z.string(),
        observations: z.array(z.number()).min(2),
        referenceSourceUrl: z.string().optional(),
        datasetLabel: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const lower = percentile(input.observations, 2.5);
      const upper = percentile(input.observations, 97.5);

      if (lower === null || upper === null || lower === upper) {
        return {
          ok: false,
          reason: "Набор наблюдений не задаёт различимых границ P2.5 / P97.5.",
          row: null,
        };
      }

      const label = input.datasetLabel?.trim();
      const serialized = input.observations.join(", ");

      const [updated] = await db
        .update(normalizationRules)
        .set({
          minReference: lower,
          maxReference: upper,
          boundsRule: BOUNDS_RULE_V1,
          referenceDataset: label ? `${label} · n=${input.observations.length}: ${serialized}` : serialized,
          ...(input.referenceSourceUrl !== undefined
            ? { referenceSourceUrl: input.referenceSourceUrl }
            : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(normalizationRules.id, input.id))
        .returning();

      return { ok: true, reason: "", row: updated ?? null };
    }),
};
