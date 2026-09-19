/**
 * AI WORLD INDEX V1 — математическое ядро.
 *
 * Цепочка расчёта:
 *   исходные данные → нормализация 0–100 → балл направления
 *   → применение веса направления → итоговый AI WORLD INDEX.
 *
 * Реальные значения показателей НЕ придумываются: наборы данных пустые,
 * пока не загружены проверенные исходные данные.
 */

import { DIRECTIONS, type Direction } from "./index-data";

export const BASE_YEAR = 2024;
/** Итоговое значение базового года после загрузки полного проверенного набора данных. */
export const BASE_YEAR_VALUE = 100;

/** Веса направлений в итоговом индексе, доли единицы. Сумма обязана быть 1 (100%). */
export const DIRECTION_WEIGHTS: Record<string, number> = {
  "01": 0.15, // Инвестиции и капитал
  "02": 0.15, // Технологии
  "03": 0.15, // Чипы и вычисления
  "04": 0.1, // Инфраструктура
  "05": 0.1, // Энергия
  "06": 0.075, // Робототехника
  "07": 0.1, // AI-бизнес
  "08": 0.075, // Распространение AI
  "09": 0.05, // Экономическое влияние
  "10": 0.05, // Кадры и экосистема
};

/** Направление нормализации: рост показателя улучшает или ухудшает балл. */
export type Polarity = "positive" | "negative";

/** Метод нормализации исходного значения в шкалу 0–100. */
export type NormalizationMethod = "minmax" | "log-minmax" | "zscore-clamped" | "manual";

export interface NormalizationConfig {
  method: NormalizationMethod;
  polarity: Polarity;
  /** Нижняя граница шкалы (для minmax / log-minmax). */
  min?: number;
  /** Верхняя граница шкалы (для minmax / log-minmax). */
  max?: number;
  /** Среднее и стандартное отклонение (для zscore-clamped). */
  mean?: number;
  stdDev?: number;
}

/** Исходный показатель внутри направления. */
export interface Indicator {
  id: string;
  /** Код направления, к которому относится показатель. */
  directionCode: string;
  title: string;
  /** Исходное значение. null — данные ещё не загружены. */
  rawValue: number | null;
  /** Единица измерения, например "млрд USD", "ТВт·ч", "шт.". */
  unit: string;
  /** Год наблюдения, например "2024". Пусто, если данных нет. */
  year: string;
  /** Период наблюдения (опционально, например "2024-Q4"). */
  period?: string;
  /** Источник данных. */
  source: string;
  /** Ссылка на источник. */
  sourceUrl: string;
  /** Вес показателя внутри направления, доля единицы (методология V1: 1/3). */
  weight: number;
  /** Параметры перевода исходного значения в шкалу 0–100. */
  normalization: NormalizationConfig;
  /** Нормализованный балл 0–100. Задаётся вручную при method === "manual". */
  score?: number | null;
  /** Проверен ли показатель методологом. */
  verified?: boolean;
}

export interface IndicatorResult {
  indicator: Indicator;
  /** Нормализованный балл 0–100 или null, если данных нет. */
  score: number | null;
  /** Нормализованный вес внутри направления (по показателям с данными). */
  effectiveWeight: number;
  /** Вклад показателя в балл направления (score × effectiveWeight). */
  contribution: number | null;
}


export interface DirectionResult {
  direction: Direction;
  weight: number;
  /** Балл направления 0–100 или null, если нет данных. */
  score: number | null;
  /** Вклад в итоговый индекс (score × weight) или null. */
  contribution: number | null;
  indicators: IndicatorResult[];
  /** Доля веса показателей направления, обеспеченная данными (0–1). */
  coverage: number;
}

export interface IndexResult {
  /** Итоговый композитный балл 0–100 или null, если данных нет. */
  compositeScore: number | null;
  /** Значение индекса относительно базы 2024 = 100, или null. */
  indexValue: number | null;
  directions: DirectionResult[];
  /** Доля веса направлений, обеспеченная данными (0–1). */
  coverage: number;
  /** Полностью ли загружен проверенный набор данных. */
  complete: boolean;
}

export const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

/** Перевод исходного значения в балл 0–100. */
export function normalize(rawValue: number | null, cfg: NormalizationConfig): number | null {
  if (rawValue === null || !Number.isFinite(rawValue)) return null;

  let unit: number;
  switch (cfg.method) {
    case "minmax": {
      const { min, max } = cfg;
      if (min === undefined || max === undefined || max === min) return null;
      unit = (rawValue - min) / (max - min);
      break;
    }
    case "log-minmax": {
      const { min, max } = cfg;
      if (min === undefined || max === undefined || min <= 0 || max <= min || rawValue <= 0)
        return null;
      unit = (Math.log(rawValue) - Math.log(min)) / (Math.log(max) - Math.log(min));
      break;
    }
    case "zscore-clamped": {
      const { mean, stdDev } = cfg;
      if (mean === undefined || !stdDev) return null;
      // ±3σ отображается на 0–1
      unit = ((rawValue - mean) / stdDev + 3) / 6;
      break;
    }
    case "manual":
      unit = rawValue / 100;
      break;
  }

  const scaled = clamp(unit * 100);
  return cfg.polarity === "negative" ? 100 - scaled : scaled;
}

/** Проверка суммы весов направлений: должна быть ровно 100%. */
export function validateDirectionWeights(weights: Record<string, number> = DIRECTION_WEIGHTS) {
  const missing = DIRECTIONS.filter((d) => weights[d.code] === undefined).map((d) => d.code);
  const sum = DIRECTIONS.reduce((acc, d) => acc + (weights[d.code] ?? 0), 0);
  const valid = missing.length === 0 && Math.abs(sum - 1) < 1e-9;
  return { valid, sum, missing };
}

/** Проверка суммы весов показателей внутри каждого направления. */
export function validateIndicatorWeights(indicators: Indicator[]) {
  return DIRECTIONS.map((d) => {
    const list = indicators.filter((i) => i.directionCode === d.code);
    const sum = list.reduce((acc, i) => acc + i.weight, 0);
    return {
      code: d.code,
      count: list.length,
      sum,
      valid: list.length === 0 || Math.abs(sum - 1) < 1e-9,
    };
  });
}

/** Полный расчёт индекса по загруженным показателям. */
export function computeIndex(
  indicators: Indicator[],
  weights: Record<string, number> = DIRECTION_WEIGHTS,
): IndexResult {
  const directions: DirectionResult[] = DIRECTIONS.map((direction) => {
    const weight = weights[direction.code] ?? 0;
    const list = indicators.filter((i) => i.directionCode === direction.code);

    const scored = list.map((indicator) => ({
      indicator,
      score:
        indicator.normalization.method === "manual"
          ? (indicator.score ?? null)
          : normalize(indicator.rawValue, indicator.normalization),
    }));


    const totalWeight = list.reduce((acc, i) => acc + i.weight, 0);
    const availableWeight = scored.reduce(
      (acc, s) => acc + (s.score === null ? 0 : s.indicator.weight),
      0,
    );

    const indicatorResults: IndicatorResult[] = scored.map((s) => {
      const effectiveWeight =
        availableWeight > 0 && s.score !== null ? s.indicator.weight / availableWeight : 0;
      return {
        indicator: s.indicator,
        score: s.score,
        effectiveWeight,
        contribution: s.score === null ? null : s.score * effectiveWeight,
      };
    });


    const score =
      availableWeight > 0
        ? indicatorResults.reduce((acc, r) => acc + (r.score ?? 0) * r.effectiveWeight, 0)
        : null;

    return {
      direction,
      weight,
      score,
      contribution: score === null ? null : score * weight,
      indicators: indicatorResults,
      coverage: totalWeight > 0 ? availableWeight / totalWeight : 0,
    };
  });

  const availableDirectionWeight = directions.reduce(
    (acc, d) => acc + (d.score === null ? 0 : d.weight),
    0,
  );

  const compositeScore =
    availableDirectionWeight > 0
      ? directions.reduce((acc, d) => acc + (d.score ?? 0) * d.weight, 0) / availableDirectionWeight
      : null;

  const complete = Math.abs(availableDirectionWeight - 1) < 1e-9 && indicators.every((i) => i.verified);

  return {
    compositeScore,
    // База: 2024 = 100. Пока полный проверенный набор не загружен, значение не публикуется.
    indexValue: complete && compositeScore !== null ? BASE_YEAR_VALUE : null,
    directions,
    coverage: availableDirectionWeight,
    complete,
  };
}

/** Текущий набор показателей. Пуст до загрузки проверенных данных. */
export const INDICATORS: Indicator[] = [];
