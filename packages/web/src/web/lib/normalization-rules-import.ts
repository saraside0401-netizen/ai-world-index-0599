/**
 * Загрузка утверждённых правил нормализации AI WORLD INDEX V1.
 *
 * Модуль ТОЛЬКО принимает и проверяет правила, подготовленные методологом.
 * Он никогда не придумывает метод, границы min/max или полярность и не
 * утверждает правила автоматически: статус берётся из переданной записи.
 */

import { DIRECTIONS } from "./index-data";

/** Методы, реально поддержанные существующим расчётным ядром. */
export const RULE_METHODS = ["minmax", "log-minmax", "zscore-clamped", "manual"] as const;
export type RuleMethod = (typeof RULE_METHODS)[number];

export const RULE_POLARITIES = ["positive", "negative"] as const;
export const RULE_STATUSES = ["approved", "pending"] as const;

export interface RuleImportRecord {
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
}

export interface RuleParseResult {
  records: RuleImportRecord[];
  errors: string[];
}

/** Шаблон одной записи правила нормализации. */
export const RULES_IMPORT_TEMPLATE = `[
  {
    "direction": "01",
    "slot": 1,
    "indicator_name": "",
    "normalization_method": "minmax",
    "min_reference": null,
    "max_reference": null,
    "polarity": "positive",
    "status": "pending",
    "reference_dataset": "",
    "reference_source_url": "",
    "bounds_rule": "L = P2.5, U = P97.5",
    "note": "L = P2.5, U = P97.5 от утверждённого reference dataset"
  }
]`;

const str = (v: unknown) =>
  typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim();

const numOrNull = (v: unknown): number | null | undefined => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : undefined;
};

/** Каким референсам обязано соответствовать правило, чтобы быть применимым. */
export function ruleNeedsReferences(method: string) {
  return method === "minmax" || method === "log-minmax" || method === "zscore-clamped";
}

/** Разбор и валидация набора правил (JSON-массив объектов). */
export function parseRuleRecords(input: string): RuleParseResult {
  const errors: string[] = [];
  const text = input.trim();
  if (!text) return { records: [], errors: ["Набор пуст: вставьте JSON-массив правил."] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { records: [], errors: ["Некорректный JSON."] };
  }
  if (!Array.isArray(parsed)) return { records: [], errors: ["Ожидается JSON-массив правил."] };

  const codes = new Set(DIRECTIONS.map((d) => d.code));
  const seen = new Set<string>();
  const records: RuleImportRecord[] = [];

  parsed.forEach((raw, idx) => {
    const label = `правило ${idx + 1}`;
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
    if (slotRaw === undefined || slotRaw === null) {
      errors.push(`${label}: обязателен slot 1–3.`);
      return;
    }
    const slot = Math.trunc(slotRaw);
    if (slot < 1 || slot > 3) {
      errors.push(`${label}: slot должен быть 1, 2 или 3.`);
      return;
    }

    const key = `${direction}#${slot}`;
    if (seen.has(key)) {
      errors.push(`${label}: дубль правила для направления ${direction}, slot ${slot}.`);
      return;
    }
    seen.add(key);

    const method = str(r["normalization_method"] ?? r["method"]);
    if (method && !RULE_METHODS.includes(method as RuleMethod)) {
      errors.push(`${label}: метод "${method}" не поддержан ядром (${RULE_METHODS.join(", ")}).`);
      return;
    }

    const minReference = numOrNull(r["min_reference"] ?? r["minReference"]);
    const maxReference = numOrNull(r["max_reference"] ?? r["maxReference"]);
    if (minReference === undefined || maxReference === undefined) {
      errors.push(`${label}: min_reference/max_reference должны быть числом или пустыми (null).`);
      return;
    }

    const polarity = str(r["polarity"]).toLowerCase();
    if (polarity && !RULE_POLARITIES.includes(polarity as (typeof RULE_POLARITIES)[number])) {
      errors.push(`${label}: polarity должна быть positive или negative.`);
      return;
    }

    const status = (str(r["status"]).toLowerCase() || "pending");
    if (!RULE_STATUSES.includes(status as (typeof RULE_STATUSES)[number])) {
      errors.push(`${label}: status должен быть approved или pending.`);
      return;
    }

    const referenceDataset = str(r["reference_dataset"] ?? r["referenceDataset"]);
    const referenceSourceUrl = str(r["reference_source_url"] ?? r["referenceSourceUrl"]);
    const boundsRule = str(r["bounds_rule"] ?? r["boundsRule"]) || "L = P2.5, U = P97.5";
    if (referenceSourceUrl && !/^https?:\/\//i.test(referenceSourceUrl)) {
      errors.push(`${label}: reference_source_url должен быть прямой ссылкой http(s).`);
      return;
    }
    if ((minReference !== null || maxReference !== null) && (!referenceDataset || !referenceSourceUrl)) {
      errors.push(
        `${label}: границы L/U допускаются только с указанием reference_dataset и reference_source_url.`,
      );
      return;
    }

    if (status === "approved") {
      if (!referenceDataset || !referenceSourceUrl) {
        errors.push(`${label}: для статуса approved обязателен reference dataset и прямой URL.`);
        return;
      }
      if (!method) {
        errors.push(`${label}: для статуса approved обязателен normalization_method.`);
        return;
      }
      if (!polarity) {
        errors.push(`${label}: для статуса approved обязательна polarity.`);
        return;
      }
      if (ruleNeedsReferences(method) && (minReference === null || maxReference === null)) {
        errors.push(
          `${label}: метод "${method}" требует обе референсные границы — значения не подставляются автоматически.`,
        );
        return;
      }
    }

    records.push({
      direction,
      slot,
      indicatorName: str(r["indicator_name"] ?? r["indicatorName"]),
      method,
      minReference,
      maxReference,
      polarity,
      status,
      note: str(r["note"]),
      referenceDataset,
      referenceSourceUrl,
      boundsRule,
    });
  });

  return { records: errors.length ? [] : records, errors };
}
