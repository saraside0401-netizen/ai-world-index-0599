/**
 * AI WORLD INDEX V1 — панель контура методолога.
 *
 * Публичный посетитель видит индекс, показатели и правила, но не может их
 * менять: поля ввода выключены до разблокировки ключом. Сам ключ проверяется
 * на сервере, любая запись без него отклоняется API.
 */

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/api";
import { useAdminGate } from "@/lib/use-admin-gate";

export function AdminGatePanel() {
  const { unlocked, checking, error, unlock, lock } = useAdminGate();
  const [value, setValue] = useState("");
  const status = useQuery(orpc.admin.status.queryOptions());
  const configured = status.data?.configured ?? true;

  return (
    <section className="mt-3 rounded-3xl border border-white/10 bg-panel/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-sm ${unlocked ? "bg-lime" : "bg-gold"}`} />
          <h2 className="font-display text-sm font-semibold tracking-wide">Контур методолога</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-paper/50">
          {unlocked ? "разблокировано" : "только чтение"}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-paper-muted">
        Данные индекса и правила нормализации доступны для чтения всем. Изменение значений,
        импорт наборов и утверждение правил требуют ключа методолога — сервер отклоняет
        любую запись без него.
      </p>

      {!configured && (
        <p className="mt-2 rounded-2xl border border-pink/30 bg-pink/10 px-3 py-2 text-[11px] text-paper/80">
          Ключ на сервере не задан: запись отключена полностью.
        </p>
      )}

      {unlocked ? (
        <button
          type="button"
          onClick={lock}
          className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-paper/80"
        >
          Заблокировать запись
        </button>
      ) : (
        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void unlock(value).then((ok) => {
              if (ok) setValue("");
            });
          }}
        >
          <input
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Ключ методолога"
            aria-label="Ключ методолога"
            autoComplete="off"
            className="w-full rounded-2xl border border-white/10 bg-ink/60 px-3 py-2 text-xs text-paper outline-none placeholder:text-paper/30"
          />
          <button
            type="submit"
            disabled={checking || !configured}
            className="w-full rounded-2xl border border-cyan/30 bg-cyan/10 px-3 py-2 text-xs font-semibold text-paper disabled:opacity-40"
          >
            {checking ? "Проверка…" : "Разблокировать"}
          </button>
        </form>
      )}

      {error && <p className="mt-2 text-[11px] text-pink">{error}</p>}
    </section>
  );
}

/**
 * Обёртка редактируемой секции: в режиме чтения все поля и кнопки внутри
 * выключены штатным `fieldset disabled`, данные при этом остаются видимыми.
 */
export function AdminWritable({ unlocked, children }: { unlocked: boolean; children: ReactNode }) {
  return (
    <fieldset disabled={!unlocked} className="contents">
      {children}
    </fieldset>
  );
}
