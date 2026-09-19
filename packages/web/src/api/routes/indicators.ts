/**
 * AI WORLD INDEX V1 — API показателей (таблица `index_indicators`).
 *
 * Перенос слоя доступа к данным из исходного проекта: раньше компоненты
 * обращались к базе напрямую из браузера, теперь всё идёт через oRPC.
 *
 * Методология не меняется:
 *   • каркас 10 направлений × 3 слота, вес показателя 1/3 — фиксированы;
 *   • значения не придумываются: null остаётся null и никогда не считается нулём;
 *   • data_status и direction_contribution выводятся по тем же правилам,
 *     что и в исходном `indicators-store.ts` (функция patchToRow).
 */

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { base } from "../__core/app";
import { adminBase } from "./admin";
import { db } from "../database";
import {
  INDICATOR_WEIGHT_DEFAULT,
  indexIndicators,
  type IndexIndicatorRow,
} from "../database/schema";

/** Методология V1: 3 показателя в направлении, равные веса. */
export const INDICATORS_PER_DIRECTION = 3;
export const INDICATOR_WEIGHT = INDICATOR_WEIGHT_DEFAULT;

/** Коды направлений каркаса — совпадают с DIRECTIONS расчётного ядра. */
const DIRECTION_CODES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"] as const;

const listOrdered = () =>
  db
    .select()
    .from(indexIndicators)
    .orderBy(asc(indexIndicators.direction), asc(indexIndicators.slot));

/**
 * Правка одной строки. Поля соответствуют модели показателя в интерфейсе;
 * передаются только изменяемые поля, остальные сохраняются как есть.
 */
const patchSchema = z.object({
  title: z.string().optional(),
  rawValue: z.number().nullable().optional(),
  unit: z.string().optional(),
  year: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
  score: z.number().nullable().optional(),
  weight: z.number().optional(),
  verified: z.boolean().optional(),
  missingReason: z.string().optional(),
});

type IndicatorPatchInput = z.infer<typeof patchSchema>;

/**
 * Вывод служебных полей строки — дословный перенос логики patchToRow
 * из исходного `indicators-store.ts`.
 *   data_status:            verified, если значение есть и оно подтверждено;
 *                           filled, если значение есть без подтверждения;
 *                           missing, если значения нет.
 *   direction_contribution: публикуется ТОЛЬКО для подтверждённых значений.
 */
function applyPatch(current: IndexIndicatorRow, patch: IndicatorPatchInput) {
  const next = {
    indicatorName: patch.title ?? current.indicatorName,
    value: patch.rawValue !== undefined ? patch.rawValue : current.value,
    unit: patch.unit ?? current.unit,
    year: patch.year ?? current.year,
    source: patch.source ?? current.source,
    sourceUrl: patch.sourceUrl ?? current.sourceUrl,
    normalizedScore: patch.score !== undefined ? patch.score : current.normalizedScore,
    indicatorWeight: patch.weight ?? current.indicatorWeight,
    missingReason: patch.missingReason ?? current.missingReason,
  };

  const verified =
    patch.verified !== undefined ? patch.verified : current.dataStatus === "verified";
  const score = next.normalizedScore ?? null;
  const hasData = next.value !== null || score !== null;

  return {
    ...next,
    dataStatus: verified && hasData ? "verified" : hasData ? "filled" : "missing",
    directionContribution: verified && score !== null ? score * next.indicatorWeight : null,
    updatedAt: new Date().toISOString(),
  };
}

/** Одна валидированная запись набора импорта (см. web/lib/indicators-import.ts). */
const importRecordSchema = z.object({
  direction: z.string(),
  slot: z.number().optional(),
  indicatorName: z.string(),
  value: z.number().nullable(),
  unit: z.string(),
  year: z.string(),
  source: z.string(),
  sourceUrl: z.string(),
  normalizedScore: z.number().nullable(),
  dataStatus: z.enum(["verified", "filled", "missing"]),
  missingReason: z.string(),
});

export const indicators = {
  /** Все 30 строк каркаса, упорядоченные по направлению и слоту. */
  list: base.handler(() => listOrdered()),

  /** Правка показателя методологом. */
  update: adminBase
    .input(z.object({ id: z.string(), patch: patchSchema }))
    .handler(async ({ input }) => {
      const [current] = await db
        .select()
        .from(indexIndicators)
        .where(eq(indexIndicators.id, input.id));
      if (!current) return null;

      const [updated] = await db
        .update(indexIndicators)
        .set(applyPatch(current, input.patch))
        .where(eq(indexIndicators.id, input.id))
        .returning();
      return updated ?? null;
    }),

  /**
   * Сохранение рассчитанных ядром баллов.
   * Пишутся только изменившиеся строки; null сохраняется как null.
   * Значения приходят из расчёта по подтверждённым данным и утверждённым
   * правилам — ничего не додумывается.
   */
  persistScores: adminBase
    .input(
      z.object({
        entries: z.array(
          z.object({
            id: z.string(),
            score: z.number().nullable(),
            contribution: z.number().nullable(),
          }),
        ),
      }),
    )
    .handler(async ({ input }) => {
      const current = await db.select().from(indexIndicators);
      const byId = new Map(current.map((row) => [row.id, row]));

      const changed = input.entries.filter((entry) => {
        const row = byId.get(entry.id);
        if (!row) return false;
        return (
          (row.normalizedScore ?? null) !== entry.score ||
          (row.directionContribution ?? null) !== entry.contribution
        );
      });

      for (const entry of changed) {
        await db
          .update(indexIndicators)
          .set({
            normalizedScore: entry.score,
            directionContribution: entry.contribution,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(indexIndicators.id, entry.id));
      }

      return { applied: changed.length };
    }),

  /**
   * Загрузка набора валидированных записей.
   * Записи только вписываются в существующий каркас 10 × 3: новые показатели
   * не создаются, веса 1/3 не меняются, значения не додумываются.
   */
  importRecords: adminBase
    .input(z.object({ records: z.array(importRecordSchema) }))
    .handler(async ({ input }) => {
      const current = await listOrdered();
      const used = new Set<string>();
      const errors: string[] = [];
      const updates: { id: string; row: Partial<IndexIndicatorRow> }[] = [];

      for (const rec of input.records) {
        const pool = current.filter((i) => i.direction === rec.direction);
        const target =
          (rec.slot !== undefined ? pool.find((i) => i.slot === rec.slot) : undefined) ??
          pool.find(
            (i) =>
              i.indicatorName.trim().toLowerCase() === rec.indicatorName.trim().toLowerCase() &&
              !used.has(i.id),
          ) ??
          pool.find((i) => !used.has(i.id) && i.indicatorName.trim() === "");

        if (!target || used.has(target.id)) {
          errors.push(
            `Направление ${rec.direction}: нет свободного слота для «${rec.indicatorName}».`,
          );
          continue;
        }
        used.add(target.id);

        const verified = rec.dataStatus === "verified";
        updates.push({
          id: target.id,
          row: {
            indicatorName: rec.indicatorName,
            value: rec.value,
            unit: rec.unit,
            year: rec.year,
            source: rec.source,
            sourceUrl: rec.sourceUrl,
            normalizedScore: rec.normalizedScore,
            indicatorWeight: INDICATOR_WEIGHT,
            dataStatus: rec.dataStatus,
            missingReason: rec.missingReason,
            directionContribution:
              verified && rec.normalizedScore !== null
                ? rec.normalizedScore * INDICATOR_WEIGHT
                : null,
            updatedAt: new Date().toISOString(),
          },
        });
      }

      if (errors.length) return { ok: false, errors, applied: 0 };

      for (const u of updates) {
        await db.update(indexIndicators).set(u.row).where(eq(indexIndicators.id, u.id));
      }
      return { ok: true, errors, applied: updates.length };
    }),

  /** Добавление слота в направление. Вес нового показателя — 1/3, как в методологии. */
  add: adminBase
    .input(z.object({ directionCode: z.string() }))
    .handler(async ({ input }) => {
      const existing = await db
        .select()
        .from(indexIndicators)
        .where(eq(indexIndicators.direction, input.directionCode));
      const slot = existing.reduce((max, i) => Math.max(max, i.slot), 0) + 1;
      const now = new Date().toISOString();

      const [row] = await db
        .insert(indexIndicators)
        .values({
          id: crypto.randomUUID(),
          direction: input.directionCode,
          slot,
          indicatorWeight: INDICATOR_WEIGHT,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row ?? null;
    }),

  remove: adminBase.input(z.object({ id: z.string() })).handler(async ({ input }) => {
    await db.delete(indexIndicators).where(eq(indexIndicators.id, input.id));
    return { ok: true };
  }),

  /** Очистка: значения обнуляются, каркас 10 × 3 восстанавливается. */
  reset: adminBase.handler(async () => {
    await db.delete(indexIndicators);
    const now = new Date().toISOString();
    const rows = DIRECTION_CODES.flatMap((code) =>
      Array.from({ length: INDICATORS_PER_DIRECTION }, (_, k) => ({
        id: crypto.randomUUID(),
        direction: code,
        slot: k + 1,
        indicatorWeight: INDICATOR_WEIGHT,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await db.insert(indexIndicators).values(rows);
    return { ok: true, rows: rows.length };
  }),
};
