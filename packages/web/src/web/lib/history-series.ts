/**
 * Преобразование исторического ряда AI WORLD INDEX в геометрию графика.
 *
 * Значения берутся только из зафиксированных точек ряда (`index_history`).
 * Пустой ряд даёт пустой массив — график покажет скелет, а не выдуманные
 * столбцы. Масштабирование затрагивает исключительно высоту столбика в
 * процентах и не меняет ни одного значения индекса.
 */

import type { IndexChartBar } from "../components/index-chart";

export interface HistoryPoint {
  observedOn: string;
  indexValue: number;
}

/** Минимальная и максимальная высота столбика, проценты области графика. */
const MIN_HEIGHT = 12;
const MAX_HEIGHT = 100;

/** Последние `limit` точек ряда → столбцы графика. */
export function toChartBars(points: HistoryPoint[], limit = 12): IndexChartBar[] {
  if (points.length === 0) return [];

  const window = points.slice(-limit);
  const values = window.map((p) => p.indexValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  return window.map((point) => ({
    // Один уровень значений по всему окну — все столбцы одной высоты.
    h:
      span === 0
        ? (MIN_HEIGHT + MAX_HEIGHT) / 2
        : MIN_HEIGHT + ((point.indexValue - min) / span) * (MAX_HEIGHT - MIN_HEIGHT),
    accent: "cyan" as const,
    label: point.observedOn,
  }));
}
