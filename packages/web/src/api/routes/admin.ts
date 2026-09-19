/**
 * AI WORLD INDEX V1 — контур методолога (admin gate).
 *
 * Разделение доступа:
 *   • чтение (`indicators.list`, `rules.list`, `ping`) — публично, без ключа;
 *   • любая запись (правка показателя, сохранение баллов, импорт, добавление
 *     и удаление слота, очистка каркаса, правка правила нормализации) —
 *     только с ключом методолога.
 *
 * Ключ хранится единственным местом — в корневом `.env` (ADMIN_KEY) — и
 * проверяется на сервере. Браузер присылает его в заголовке `x-admin-key`.
 *
 * Методология этим контуром не затрагивается: ключ решает только «кому можно
 * писать», а не «что считается». Формулы, веса направлений, вес 1/3 внутри
 * направления и правило «MISSING не равно нулю» остаются без изменений.
 */

import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { base } from "../__core/app";

/** Заголовок с ключом методолога. */
export const ADMIN_HEADER = "x-admin-key";

function expectedKey() {
  return process.env["ADMIN_KEY"] ?? "";
}

/** Сравнение постоянного времени — чтобы ключ нельзя было подобрать по времени ответа. */
function keyMatches(candidate: string) {
  const expected = expectedKey();
  if (!expected || candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Базовая процедура записи: требует корректный ключ методолога.
 * Если ключ на сервере не задан — запись запрещена полностью
 * (безопасный отказ вместо открытой базы).
 */
export const adminBase = base.use(({ context, next }) => {
  if (!expectedKey()) {
    throw new ORPCError("FORBIDDEN", {
      message: "Контур методолога не настроен: ADMIN_KEY отсутствует на сервере.",
    });
  }

  const provided = context.headers.get(ADMIN_HEADER) ?? "";
  if (!keyMatches(provided)) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Требуется ключ методолога: изменение данных запрещено.",
    });
  }

  return next();
});

export const admin = {
  /** Публично: настроен ли контур записи (без раскрытия самого ключа). */
  status: base.handler(() => ({ configured: expectedKey().length > 0 })),

  /** Проверка ключа для формы разблокировки в интерфейсе. */
  verify: base.input(z.object({ key: z.string() })).handler(({ input }) => ({
    ok: keyMatches(input.key),
  })),
};
