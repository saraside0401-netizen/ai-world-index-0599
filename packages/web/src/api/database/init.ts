/**
 * Автосоздание таблиц и каркаса 10 × 3 при первом запуске.
 *
 * Вызывается один раз при старте сервера. Если таблицы уже существуют
 * и каркас заполнен — ничего не делает. Значения не придумываются:
 * строки каркаса получают data_status = "missing", value = null.
 */

import { sql } from "drizzle-orm";
import { db } from "./__client";
import {
  INDICATOR_WEIGHT_DEFAULT,
  BOUNDS_RULE_DEFAULT,
  indexIndicators,
  normalizationRules,
} from "./schema";

const DIRECTION_CODES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"];
const SLOTS = [1, 2, 3];

async function tableExists(name: string): Promise<boolean> {
  const result = await db.run(
    sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${name}`,
  );
  return result.rows.length > 0;
}

export async function initDatabase(): Promise<void> {
  const hasIndicators = await tableExists("index_indicators");
  const hasRules = await tableExists("normalization_rules");
  const hasHistory = await tableExists("index_history");

  if (!hasIndicators) {
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS index_indicators (
        id TEXT PRIMARY KEY,
        direction TEXT NOT NULL,
        slot REAL NOT NULL,
        indicator_name TEXT NOT NULL DEFAULT '',
        value REAL,
        unit TEXT NOT NULL DEFAULT '',
        year TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT '',
        normalized_score REAL,
        indicator_weight REAL NOT NULL DEFAULT ${INDICATOR_WEIGHT_DEFAULT},
        direction_contribution REAL,
        data_status TEXT NOT NULL DEFAULT 'missing',
        missing_reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS index_indicators_direction_idx
      ON index_indicators (direction, slot)
    `);
    await db.run(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS index_indicators_direction_slot_key
      ON index_indicators (direction, slot)
    `);
  }

  if (!hasRules) {
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS normalization_rules (
        id TEXT PRIMARY KEY,
        direction TEXT NOT NULL,
        slot REAL NOT NULL,
        indicator_name TEXT NOT NULL DEFAULT '',
        normalization_method TEXT NOT NULL DEFAULT '',
        min_reference REAL,
        max_reference REAL,
        polarity TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        note TEXT NOT NULL DEFAULT '',
        reference_dataset TEXT NOT NULL DEFAULT '',
        reference_source_url TEXT NOT NULL DEFAULT '',
        bounds_rule TEXT NOT NULL DEFAULT ${BOUNDS_RULE_DEFAULT},
        rule_version TEXT NOT NULL DEFAULT 'V1.0',
        verified_at TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    await db.run(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS normalization_rules_direction_slot_key
      ON normalization_rules (direction, slot)
    `);
  }

  if (!hasHistory) {
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS index_history (
        id TEXT PRIMARY KEY,
        observed_on TEXT NOT NULL,
        index_value REAL NOT NULL,
        composite_score REAL NOT NULL,
        coverage REAL NOT NULL,
        verified_count REAL NOT NULL,
        methodology_version TEXT NOT NULL DEFAULT 'V1.0',
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    await db.run(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS index_history_observed_on_key
      ON index_history (observed_on)
    `);
  }

  // Каркас 10 × 3 для показателей, если пусто.
  const indicatorCount = await db.run(sql`SELECT COUNT(*) as c FROM index_indicators`);
  const count = Number(indicatorCount.rows[0]?.c ?? 0);
  if (count === 0) {
    const now = new Date().toISOString();
    for (const code of DIRECTION_CODES) {
      for (const slot of SLOTS) {
        await db.insert(indexIndicators).values({
          id: crypto.randomUUID(),
          direction: code,
          slot,
          indicatorWeight: INDICATOR_WEIGHT_DEFAULT,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  // Каркас 10 × 3 для правил нормализации, если пусто.
  const ruleCount = await db.run(sql`SELECT COUNT(*) as c FROM normalization_rules`);
  const ruleC = Number(ruleCount.rows[0]?.c ?? 0);
  if (ruleC === 0) {
    const now = new Date().toISOString();
    for (const code of DIRECTION_CODES) {
      for (const slot of SLOTS) {
        await db.insert(normalizationRules).values({
          id: crypto.randomUUID(),
          direction: code,
          slot,
          boundsRule: BOUNDS_RULE_DEFAULT,
          ruleVersion: "V1.0",
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }
}
