/**
 * Хранилище исходных данных AI WORLD INDEX V1.
 *
 * Данные хранятся постоянно в базе проекта, таблица `index_indicators`,
 * и читаются через oRPC (`api/routes/indicators.ts`). Значения НЕ придумываются:
 * каркас 10 направлений × 3 индикатора с равными весами 1/3 зафиксирован
 * методологией, отсутствующее значение остаётся null и никогда не считается нулём.
 *
 * Отличие от исходной версии проекта только в транспорте: прямые обращения
 * браузера к базе заменены типизированными процедурами oRPC. Бизнес-логика
 * здесь не дублируется — вывод data_status и direction_contribution выполняется
 * на сервере, расчёт баллов остаётся в `index-core.ts`.
 */

import { useCallback } from "react";
import type { IndexIndicatorRow } from "../../api/database/schema";
import {
  useAddIndicator,
  useImportIndicatorRecords,
  useIndicatorsQuery,
  usePersistScores,
  useRemoveIndicator,
  useResetIndicators,
  useUpdateIndicator,
} from "../queries/indicators";
import type { Indicator } from "./index-core";
import type { ImportRecord } from "./indicators-import";

/** Методология V1: 3 индикатора в направлении, равные веса. */
export const INDICATORS_PER_DIRECTION = 3;
export const INDICATOR_WEIGHT = 1 / INDICATORS_PER_DIRECTION;

/** Показатель в интерфейсе + служебные поля строки базы. */
export type StoredIndicator = Indicator & {
  slot: number;
  dataStatus: string;
  missingReason: string;
  directionContribution: number | null;
};

function rowToIndicator(row: IndexIndicatorRow): StoredIndicator {
  return {
    id: row.id,
    directionCode: row.direction,
    slot: row.slot,
    title: row.indicatorName,
    rawValue: row.value,
    unit: row.unit,
    year: row.year,
    source: row.source,
    sourceUrl: row.sourceUrl,
    weight: row.indicatorWeight ?? INDICATOR_WEIGHT,
    normalization: { method: "manual", polarity: "positive" },
    score: row.normalizedScore,
    verified: row.dataStatus === "verified",
    dataStatus: row.dataStatus,
    missingReason: row.missingReason,
    directionContribution: row.directionContribution,
  };
}

/** Правка строки: поля показателя + служебные поля статуса. */
export type IndicatorPatch = Partial<Indicator> & {
  missingReason?: string;
};

/**
 * Набор для расчётного ядра: используются ТОЛЬКО подтверждённые значения.
 * Неподтверждённые и отсутствующие показатели передаются без значений,
 * поэтому missing никогда не трактуется как ноль.
 */
export function confirmedOnly(list: StoredIndicator[]): StoredIndicator[] {
  return list.map((i) =>
    i.verified && i.dataStatus === "verified"
      ? i
      : { ...i, rawValue: null, score: null, verified: false },
  );
}

/** Реактивная таблица показателей: чтение и запись через API проекта. */
export function useIndicators() {
  const query = useIndicatorsQuery();
  const updateMutation = useUpdateIndicator();
  const persistMutation = usePersistScores();
  const importMutation = useImportIndicatorRecords();
  const addMutation = useAddIndicator();
  const removeMutation = useRemoveIndicator();
  const resetMutation = useResetIndicators();

  const indicators: StoredIndicator[] = (query.data ?? []).map(rowToIndicator);
  const hydrated = query.isFetched;

  const { mutate: mutateUpdate } = updateMutation;
  const update = useCallback(
    (id: string, patch: IndicatorPatch) => {
      mutateUpdate({
        id,
        patch: {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.rawValue !== undefined ? { rawValue: patch.rawValue } : {}),
          ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
          ...(patch.year !== undefined ? { year: patch.year } : {}),
          ...(patch.source !== undefined ? { source: patch.source } : {}),
          ...(patch.sourceUrl !== undefined ? { sourceUrl: patch.sourceUrl } : {}),
          ...(patch.score !== undefined ? { score: patch.score } : {}),
          ...(patch.weight !== undefined ? { weight: patch.weight } : {}),
          ...(patch.verified !== undefined ? { verified: Boolean(patch.verified) } : {}),
          ...(patch.missingReason !== undefined ? { missingReason: patch.missingReason } : {}),
        },
      });
    },
    [mutateUpdate],
  );

  /**
   * Загрузка единого набора валидированных записей.
   * Записи только вписываются в существующий каркас 10 × 3: новые показатели
   * не создаются, веса 1/3 не меняются, значения не додумываются.
   */
  const { mutateAsync: mutateImport } = importMutation;
  const importRecords = useCallback(
    async (records: ImportRecord[]) => {
      const result = await mutateImport({
        records: records.map((rec) => ({
          direction: rec.direction,
          ...(rec.slot !== undefined ? { slot: rec.slot } : {}),
          indicatorName: rec.indicatorName,
          value: rec.value,
          unit: rec.unit,
          year: rec.year,
          source: rec.source,
          sourceUrl: rec.sourceUrl,
          normalizedScore: rec.normalizedScore,
          dataStatus: rec.dataStatus,
          missingReason: rec.missingReason,
        })),
      });
      return { ok: result.ok, errors: result.errors, applied: result.applied };
    },
    [mutateImport],
  );

  const { mutate: mutateAdd } = addMutation;
  const add = useCallback(
    (directionCode: string) => {
      mutateAdd({ directionCode });
    },
    [mutateAdd],
  );

  const { mutate: mutateRemove } = removeMutation;
  const remove = useCallback(
    (id: string) => {
      mutateRemove({ id });
    },
    [mutateRemove],
  );

  /**
   * Сохранение рассчитанных ядром баллов в базу.
   * Пишутся только значения, полученные из подтверждённых данных
   * и утверждённых правил нормализации; null тоже сохраняется как null.
   * Отбор изменившихся строк выполняет сервер.
   */
  const { mutateAsync: mutatePersist } = persistMutation;
  const persistScores = useCallback(
    async (entries: { id: string; score: number | null; contribution: number | null }[]) => {
      if (entries.length === 0) return;
      await mutatePersist({ entries });
    },
    [mutatePersist],
  );

  /** Очистка: значения обнуляются, каркас 10 × 3 восстанавливается. */
  const { mutate: mutateReset } = resetMutation;
  const reset = useCallback(() => {
    mutateReset({});
  }, [mutateReset]);

  return {
    indicators,
    hydrated,
    update,
    persistScores,
    add,
    remove,
    importRecords,
    reset,
  };
}
