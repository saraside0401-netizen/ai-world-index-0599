/**
 * Загрузка единого набора валидированных исходных данных AI WORLD INDEX V1.
 *
 * Модуль ТОЛЬКО принимает и проверяет данные, подготовленные вручную.
 * Он никогда не генерирует, не достраивает и не подменяет значения:
 * отсутствующее значение остаётся пустым со статусом "missing" и причиной.
 */

import { DIRECTIONS } from "./index-data";

export const DATA_STATUSES = ["verified", "filled", "missing"] as const;
export type DataStatus = (typeof DATA_STATUSES)[number];

/** Одна валидированная запись показателя. */
export interface ImportRecord {
  direction: string;
  slot?: number | undefined;
  indicatorName: string;
  value: number | null;
  unit: string;
  year: string;
  source: string;
  sourceUrl: string;
  /** Нормализованный балл 0–100, если он рассчитан вне приложения. */
  normalizedScore: number | null;
  dataStatus: DataStatus;
  missingReason: string;
}

export interface ParseResult {
  records: ImportRecord[];
  errors: string[];
}

/** Шаблон одной записи для подготовки набора из 30 показателей. */
export const IMPORT_TEMPLATE = `[
  {
    "direction": "01",
    "slot": 1,
    "indicator_name": "",
    "value": null,
    "unit": "",
    "year": "",
    "source": "",
    "source_url": "",
    "normalized_score": null,
    "data_status": "missing",
    "missing_reason": "подтверждённое значение ещё не получено"
  }
]`;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim());

const numOrNull = (v: unknown): number | null | undefined => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : undefined;
};

const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

/**
 * Разбор и валидация набора записей (JSON-массив объектов).
 * Возвращает записи только если они прошли все правила методологии.
 */
export function parseIndicatorRecords(input: string): ParseResult {
  const errors: string[] = [];
  const text = input.trim();
  if (!text) return { records: [], errors: ["Набор пуст: вставьте JSON-массив записей."] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { records: [], errors: ["Некорректный JSON."] };
  }
  if (!Array.isArray(parsed)) return { records: [], errors: ["Ожидается JSON-массив записей."] };

  const codes = new Set(DIRECTIONS.map((d) => d.code));
  const seen = new Set<string>();
  const records: ImportRecord[] = [];

  parsed.forEach((raw, idx) => {
    const label = `запись ${idx + 1}`;
    if (typeof raw !== "object" || raw === null) {
      errors.push(`${label}: ожидается объект.`);
      return;
    }
    const r = raw as Record<string, unknown>;

    const direction = str(r["direction"]);
    if (!codes.has(direction)) {
      errors.push(`${label}: неизвестное направление "${direction}". Допустимы коды 01–10.`);
      return;
    }

    const slotRaw = numOrNull(r["slot"]);
    const slot = slotRaw === undefined || slotRaw === null ? undefined : Math.trunc(slotRaw);
    if (slot !== undefined && (slot < 1 || slot > 3)) {
      errors.push(`${label}: slot должен быть 1, 2 или 3 (методология: 3 показателя в направлении).`);
      return;
    }

    const indicatorName = str(r["indicator_name"] ?? r["indicatorName"]);
    if (!indicatorName) {
      errors.push(`${label}: indicator_name обязателен — подмена показателей не допускается.`);
      return;
    }

    const key = `${direction}#${slot ?? indicatorName.toLowerCase()}`;
    if (seen.has(key)) {
      errors.push(`${label}: дубль показателя в направлении ${direction}.`);
      return;
    }
    seen.add(key);

    const value = numOrNull(r["value"]);
    if (value === undefined) {
      errors.push(`${label}: value должно быть числом или пустым (null).`);
      return;
    }
    const normalizedScore = numOrNull(r["normalized_score"] ?? r["normalizedScore"]);
    if (normalizedScore === undefined) {
      errors.push(`${label}: normalized_score должно быть числом 0–100 или пустым.`);
      return;
    }
    if (normalizedScore !== null && (normalizedScore < 0 || normalizedScore > 100)) {
      errors.push(`${label}: normalized_score вне диапазона 0–100.`);
      return;
    }

    const statusRaw = str(r["data_status"] ?? r["dataStatus"]).toLowerCase();
    if (!DATA_STATUSES.includes(statusRaw as DataStatus)) {
      errors.push(`${label}: data_status должен быть verified, filled или missing.`);
      return;
    }
    const dataStatus = statusRaw as DataStatus;

    const unit = str(r["unit"]);
    const year = str(r["year"]);
    const source = str(r["source"]);
    const sourceUrl = str(r["source_url"] ?? r["sourceUrl"]);
    const missingReason = str(r["missing_reason"] ?? r["missingReason"]);

    if (value === null) {
      if (dataStatus !== "missing") {
        errors.push(`${label}: значение пустое — data_status обязан быть "missing".`);
        return;
      }
      if (!missingReason) {
        errors.push(`${label}: для пустого значения обязателен missing_reason.`);
        return;
      }
    } else {
      if (dataStatus === "missing") {
        errors.push(`${label}: значение заполнено — статус "missing" недопустим.`);
        return;
      }
      if (!year) errors.push(`${label}: обязателен year.`);
      if (!unit) errors.push(`${label}: обязателен unit.`);
      if (!source) errors.push(`${label}: обязателен source.`);
      if (!sourceUrl || !isHttpUrl(sourceUrl)) {
        errors.push(`${label}: обязателен прямой source_url (http/https).`);
      }
      // normalized_score не обязателен: балл рассчитывает существующий
      // pipeline по утверждённым правилам нормализации. Значение из набора
      // принимается только если оно передано явно.
    }

    records.push({
      direction,
      slot,
      indicatorName,
      value,
      unit,
      year,
      source,
      sourceUrl,
      normalizedScore,
      dataStatus,
      missingReason: value === null ? missingReason : "",
    });
  });

  return { records: errors.length ? [] : records, errors };
}

/**
 * Каркас набора для импорта: строится ТОЛЬКО из уже существующих 30 строк базы
 * (направление, slot, название) и их текущих значений. Ничего не додумывается:
 * пустые поля остаются пустыми, статус пустых записей — "missing".
 */
export function buildImportSkeleton(
  list: {
    directionCode: string;
    slot: number;
    title: string;
    rawValue: number | null;
    unit: string;
    year: string;
    source: string;
    sourceUrl: string;
    dataStatus: string;
    missingReason: string;
  }[],
): string {
  const rows = [...list]
    .sort((a, b) =>
      a.directionCode === b.directionCode
        ? a.slot - b.slot
        : a.directionCode.localeCompare(b.directionCode),
    )
    .map((i) => ({
      direction: i.directionCode,
      slot: i.slot,
      indicator_name: i.title,
      value: i.rawValue,
      unit: i.unit,
      year: i.year,
      source: i.source,
      source_url: i.sourceUrl,
      data_status: i.rawValue === null ? "missing" : i.dataStatus || "filled",
      missing_reason:
        i.rawValue === null
          ? i.missingReason || "подтверждённое значение ещё не получено"
          : "",
    }));
  return JSON.stringify(rows, null, 2);
}

/** Список незаполненных обязательных полей записи (для чек-листа интерфейса). */
export function missingSourceFields(i: {
  rawValue: number | null;
  unit: string;
  year: string;
  source: string;
  sourceUrl: string;
}): string[] {
  const gaps: string[] = [];
  if (i.rawValue === null) gaps.push("value");
  if (!i.unit.trim()) gaps.push("unit");
  if (!i.year.trim()) gaps.push("year");
  if (!i.source.trim()) gaps.push("source");
  if (!isHttpUrl(i.sourceUrl.trim())) gaps.push("source_url");
  return gaps;

}
