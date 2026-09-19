/**
 * AI WORLD INDEX V1 — исторический ряд индекса.
 *
 * Точка ряда записывается только по факту состоявшегося расчёта:
 *   • complete = true (весь вес 10 направлений обеспечен данными);
 *   • compositeScore и indexValue рассчитаны ядром, а не заданы вручную.
 *
 * Иллюстративных, интерполированных и «ожидаемых» точек в ряде нет.
 * Пустой ряд — корректное состояние: индекс ещё не рассчитывался.
 */

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { base } from "../__core/app";
import { adminBase } from "./admin";
import { db } from "../database";
import { indexHistory } from "../database/schema";

const pointSchema = z.object({
  /** Дата точки, YYYY-MM-DD. */
  observedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  indexValue: z.number(),
  compositeScore: z.number(),
  coverage: z.number(),
  verifiedCount: z.number(),
});

export const history = {
  /** Весь ряд по возрастанию даты. Публично. */
  list: base.handler(() =>
    db.select().from(indexHistory).orderBy(asc(indexHistory.observedOn)),
  ),

  /**
   * Фиксация точки ряда. Только методолог.
   * Полнота набора проверяется здесь повторно: точка с coverage < 1
   * или без рассчитанного значения в ряд не попадает.
   */
  append: adminBase.input(pointSchema).handler(async ({ input }) => {
    if (!Number.isFinite(input.indexValue) || !Number.isFinite(input.compositeScore)) {
      return { ok: false, reason: "Значение индекса не рассчитано." as string, row: null };
    }
    if (Math.abs(input.coverage - 1) > 1e-9) {
      return {
        ok: false,
        reason: "Набор данных неполный: точка ряда не фиксируется.",
        row: null,
      };
    }

    const [existing] = await db
      .select()
      .from(indexHistory)
      .where(eq(indexHistory.observedOn, input.observedOn));

    if (existing) {
      const [updated] = await db
        .update(indexHistory)
        .set({
          indexValue: input.indexValue,
          compositeScore: input.compositeScore,
          coverage: input.coverage,
          verifiedCount: input.verifiedCount,
        })
        .where(eq(indexHistory.id, existing.id))
        .returning();
      return { ok: true, reason: "", row: updated ?? null };
    }

    const [row] = await db
      .insert(indexHistory)
      .values({
        id: crypto.randomUUID(),
        observedOn: input.observedOn,
        indexValue: input.indexValue,
        compositeScore: input.compositeScore,
        coverage: input.coverage,
        verifiedCount: input.verifiedCount,
        createdAt: new Date().toISOString(),
      })
      .returning();
    return { ok: true, reason: "", row: row ?? null };
  }),
};
