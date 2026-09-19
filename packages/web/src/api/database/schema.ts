import { sql } from "drizzle-orm";
import { index, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * AI WORLD INDEX V1 — схема данных.
 *
 * Точное зеркало таблиц исходного проекта (Supabase / Lovable Cloud):
 * `index_indicators` и `normalization_rules`. Имена колонок, типы, значения
 * по умолчанию и ограничения сохранены 1:1, чтобы методология, веса и
 * проверенные данные переносились без изменений.
 *
 * Отличия только в типах хранения, продиктованные SQLite:
 *   NUMERIC  -> real
 *   UUID     -> text (значения id переносятся как есть)
 *   TIMESTAMPTZ -> text (ISO-8601, исходные метки времени сохраняются дословно)
 */

/** Методология V1: 3 показателя в направлении, равные веса 1/3. */
export const INDICATOR_WEIGHT_DEFAULT = 1 / 3;

/** Правило V1.0 для референсных границ. */
export const BOUNDS_RULE_DEFAULT = "L = P2.5, U = P97.5";

/**
 * 30 показателей: 10 направлений × 3 слота.
 * `value` = null означает отсутствие данных и НИКОГДА не трактуется как ноль.
 */
export const indexIndicators = sqliteTable(
  "index_indicators",
  {
    id: text("id").primaryKey(),
    /** Код направления 01–10. */
    direction: text("direction").notNull(),
    /** Слот показателя внутри направления: 1, 2 или 3. */
    slot: real("slot").notNull(),
    indicatorName: text("indicator_name").notNull().default(""),
    /** Исходное значение. null — данные не получены. */
    value: real("value"),
    unit: text("unit").notNull().default(""),
    year: text("year").notNull().default(""),
    source: text("source").notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    /** Нормализованный балл 0–100. null, пока правило не утверждено. */
    normalizedScore: real("normalized_score"),
    /** Вес показателя внутри направления, доля единицы (V1: 1/3). */
    indicatorWeight: real("indicator_weight").notNull().default(INDICATOR_WEIGHT_DEFAULT),
    /** Вклад в балл направления. Публикуется только для подтверждённых значений. */
    directionContribution: real("direction_contribution"),
    /** verified | filled | missing */
    dataStatus: text("data_status").notNull().default("missing"),
    /** Обязательная причина, если значение отсутствует. */
    missingReason: text("missing_reason").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("index_indicators_direction_idx").on(table.direction, table.slot),
    uniqueIndex("index_indicators_direction_slot_key").on(table.direction, table.slot),
  ],
);

/**
 * 30 правил нормализации — по одному на каждый показатель.
 * Правило применяется к расчёту ТОЛЬКО при status = "approved".
 */
export const normalizationRules = sqliteTable(
  "normalization_rules",
  {
    id: text("id").primaryKey(),
    direction: text("direction").notNull(),
    slot: real("slot").notNull(),
    indicatorName: text("indicator_name").notNull().default(""),
    /** minmax | log-minmax | zscore-clamped | manual */
    normalizationMethod: text("normalization_method").notNull().default(""),
    /** Нижняя референсная граница L (или mean для zscore-clamped). */
    minReference: real("min_reference"),
    /** Верхняя референсная граница U (или stdDev для zscore-clamped). */
    maxReference: real("max_reference"),
    /** positive | negative */
    polarity: text("polarity").notNull().default(""),
    /** approved | pending */
    status: text("status").notNull().default("pending"),
    note: text("note").notNull().default(""),
    referenceDataset: text("reference_dataset").notNull().default(""),
    referenceSourceUrl: text("reference_source_url").notNull().default(""),
    boundsRule: text("bounds_rule").notNull().default(BOUNDS_RULE_DEFAULT),
    /** Версия методологии правила, например "V1.0". */
    ruleVersion: text("rule_version").notNull().default("V1.0"),
    /** Момент утверждения правила методологом. null, пока не утверждено. */
    verifiedAt: text("verified_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [uniqueIndex("normalization_rules_direction_slot_key").on(table.direction, table.slot)],
);

/**
 * Исторический ряд AI WORLD INDEX.
 *
 * Точка ряда фиксируется ТОЛЬКО по факту завершённого расчёта на полном
 * проверенном наборе данных (complete = true, index_value != null).
 * Иллюстративные и интерполированные точки в ряд не попадают: пустой ряд
 * означает, что индекс ещё ни разу не был рассчитан.
 *
 * База методологии: 2024 = 100 (см. BASE_YEAR / BASE_YEAR_VALUE ядра).
 */
export const indexHistory = sqliteTable(
  "index_history",
  {
    id: text("id").primaryKey(),
    /** Дата точки ряда, ISO-8601 (YYYY-MM-DD) — уникальна. */
    observedOn: text("observed_on").notNull(),
    /** Значение индекса относительно базы 2024 = 100. */
    indexValue: real("index_value").notNull(),
    /** Композитный балл 0–100 на момент расчёта. */
    compositeScore: real("composite_score").notNull(),
    /** Доля веса направлений, обеспеченная данными (0–1). Для полного набора = 1. */
    coverage: real("coverage").notNull(),
    /** Число подтверждённых показателей, участвовавших в расчёте. */
    verifiedCount: real("verified_count").notNull(),
    /** Версия методологии расчёта точки. */
    methodologyVersion: text("methodology_version").notNull().default("V1.0"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [uniqueIndex("index_history_observed_on_key").on(table.observedOn)],
);

export type IndexIndicatorRow = typeof indexIndicators.$inferSelect;
export type NormalizationRuleRow = typeof normalizationRules.$inferSelect;
export type IndexHistoryRow = typeof indexHistory.$inferSelect;
