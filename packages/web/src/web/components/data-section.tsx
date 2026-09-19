/**
 * Раздел «Данные» — рабочая таблица исходных показателей AI WORLD INDEX V1.
 *
 * Цепочка: таблица → валидация → нормализация 0–100 → 3 индикатора направления
 * → 10 Direction Scores → веса направлений → Composite Score → AI WORLD INDEX.
 *
 * Значения вносятся вручную. Выдуманные данные не подставляются.
 */

import { useMemo, useState } from "react";
import { DIRECTIONS } from "@/lib/index-data";
import {
  INDICATOR_WEIGHT,
  type IndicatorPatch,
  type StoredIndicator,
} from "@/lib/indicators-store";
import { useIndexPipeline } from "@/lib/use-index-pipeline";
import {
  IMPORT_TEMPLATE,
  buildImportSkeleton,
  missingSourceFields,
  parseIndicatorRecords,
} from "@/lib/indicators-import";

const FIELD_LABELS: Record<string, string> = {
  value: "Value",
  unit: "Unit",
  year: "Year",
  source: "Source",
  source_url: "Source URL",
};

type FillStatus = "filled" | "needs-source" | "needs-value";

/** Статус заполнения исходных данных записи (нормализация здесь не участвует). */
function fillStatus(gaps: string[]): FillStatus {
  if (gaps.includes("value")) return "needs-value";
  if (gaps.length > 0) return "needs-source";
  return "filled";
}

const FILL_LABEL: Record<FillStatus, string> = {
  filled: "заполнено",
  "needs-source": "требует источника",
  "needs-value": "требует значения",
};

const FILL_CLASS: Record<FillStatus, string> = {
  filled: "border-lime/30 bg-lime/10 text-lime",
  "needs-source": "border-gold/30 bg-gold/10 text-gold",
  "needs-value": "border-pink/30 bg-pink/10 text-pink",
};



const num = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(digits);

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-paper/85 outline-none placeholder:text-paper/25 focus:border-cyan/40";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[9px] tracking-wide text-paper/35 uppercase">{label}</span>
      {children}
    </label>
  );
}

function IndicatorRow({
  indicator,
  score,
  contribution,
  onChange,
  onRemove,
}: {
  indicator: StoredIndicator;
  score: number | null;
  contribution: number | null;
  onChange: (patch: IndicatorPatch) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const gaps = missingSourceFields(indicator);
  const fill = fillStatus(gaps);





  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
      >
        <span className="flex-1 truncate text-[11px] text-paper/75">
          {indicator.title || "Показатель не заполнен"}
        </span>
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[9px] ${
            indicator.dataStatus === "verified"
              ? "border-lime/30 bg-lime/10 text-lime"
              : indicator.dataStatus === "filled"
                ? "border-cyan/30 bg-cyan/10 text-cyan"
                : "border-white/10 bg-white/5 text-paper/40"
          }`}
        >
          {indicator.dataStatus === "verified"
            ? "проверен"
            : indicator.dataStatus === "filled"
              ? "не подтверждён"
              : "нет данных"}
        </span>
        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${FILL_CLASS[fill]}`}>
          {FILL_LABEL[fill]}
        </span>

        <span className="font-display text-[10px] text-cyan">{num(score, 0)}</span>
        <span className="w-12 text-right text-[10px] text-paper/40">{num(contribution, 1)}</span>
        <span className="text-[10px] text-paper/30">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-white/10 px-2.5 py-2">
          <Field label="Название показателя">
            <input
              aria-label="Название показателя"
              className={inputClass}
              value={indicator.title}
              placeholder="не заполнено"
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Значение">
              <input
                aria-label="Значение"
                className={inputClass}
                inputMode="decimal"
                value={indicator.rawValue ?? ""}
                placeholder="пусто"
                onChange={(e) => {
                  const v = e.target.value.trim().replace(",", ".");
                  onChange({ rawValue: v === "" ? null : Number(v) });
                }}
              />
            </Field>
            <Field label="Единица измерения">
              <input
                aria-label="Единица измерения"
                className={inputClass}
                value={indicator.unit}
                placeholder="пусто"
                onChange={(e) => onChange({ unit: e.target.value })}
              />
            </Field>
            <Field label="Год">
              <input
                aria-label="Год"
                className={inputClass}
                inputMode="numeric"
                value={indicator.year}
                placeholder="пусто"
                onChange={(e) => onChange({ year: e.target.value })}
              />
            </Field>
            <Field label="Нормализованный балл 0–100">
              <input
                aria-label="Нормализованный балл 0–100"
                className={inputClass}
                inputMode="decimal"
                value={indicator.score ?? ""}
                placeholder="пусто"
                onChange={(e) => {
                  const v = e.target.value.trim().replace(",", ".");
                  const n = v === "" ? null : Number(v);
                  onChange({
                    score: n === null || !Number.isFinite(n) ? null : Math.min(100, Math.max(0, n)),
                  });
                }}
              />
            </Field>
          </div>

          <Field label="Источник">
            <input
              aria-label="Источник"
              className={inputClass}
              value={indicator.source}
              placeholder="пусто"
              onChange={(e) => onChange({ source: e.target.value })}
            />
          </Field>
          <Field label="Ссылка на источник">
            <input
              aria-label="Ссылка на источник"
              className={inputClass}
              value={indicator.sourceUrl}
              placeholder="пусто"
              onChange={(e) => onChange({ sourceUrl: e.target.value })}
            />
          </Field>

          <Field label="Причина отсутствия данных (missing_reason)">
            <input
              aria-label="Причина отсутствия данных (missing_reason)"
              className={inputClass}
              value={indicator.missingReason}
              placeholder={indicator.rawValue === null ? "обязательно, если значения нет" : "не требуется"}
              onChange={(e) => onChange({ missingReason: e.target.value })}
            />
          </Field>

          {gaps.length > 0 && (
            <div className="rounded-xl border border-gold/30 bg-gold/10 px-2.5 py-2">
              <span className="text-[9px] tracking-wide text-gold/80 uppercase">
                Не заполнено
              </span>
              <ul className="mt-1 space-y-0.5 text-[10px] text-gold">
                {gaps.map((g) => (
                  <li key={g}>• {FIELD_LABELS[g] ?? g}</li>
                ))}
              </ul>
            </div>
          )}



          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-paper/40">
              Вес: {(indicator.weight * 100).toFixed(1)}% · вклад: {num(contribution, 2)}
            </span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] text-paper/50">
                <input
                  aria-label="Показатель проверен"
                  type="checkbox"
                  checked={Boolean(indicator.verified)}
                  onChange={(e) => onChange({ verified: e.target.checked })}
                />
                проверен
              </label>
              <button
                type="button"
                onClick={onRemove}
                className="rounded-full border border-pink/30 bg-pink/10 px-2 py-0.5 text-[10px] text-pink"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DataSection() {
  // Единый расчётный контур — тот же, что и в IndexCore.
  const { indicators, hydrated, update, add, remove, importRecords, reset, result, counts } =
    useIndexPipeline();

  const byId = useMemo(
    () => new Map(indicators.map((i) => [i.id, i])),
    [indicators],
  );

  const verifiedCount = counts.verified;
  const missingCount = counts.missing;

  // Сводка по заполнению исходных данных (без нормализации).
  const fillCounts = useMemo(() => {
    const acc = { filled: 0, "needs-source": 0, "needs-value": 0 } as Record<FillStatus, number>;
    for (const i of indicators) acc[fillStatus(missingSourceFields(i))] += 1;
    return acc;
  }, [indicators]);



  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importNote, setImportNote] = useState("");
  const [importing, setImporting] = useState(false);

  const runImport = async () => {
    setImportNote("");
    const { records, errors } = parseIndicatorRecords(importText);
    if (errors.length) {
      setImportErrors(errors);
      return;
    }
    setImportErrors([]);
    setImporting(true);
    const res = await importRecords(records);
    setImporting(false);
    if (!res.ok) {
      setImportErrors(res.errors);
      return;
    }
    setImportNote(`Загружено записей: ${res.applied}.`);
  };

  return (
    <section id="data" className="mt-3 rounded-3xl border border-white/10 bg-panel/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-sm bg-lime" />
          <h2 className="font-display text-sm font-semibold tracking-wide">Данные</h2>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-paper/50"
        >
          Очистить
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-paper/55">
        Ручной ввод исходных данных: направление, показатель, значение, единица, год, источник и
        ссылка, нормализованный балл 0–100, вес {(INDICATOR_WEIGHT * 100).toFixed(1)}% и вклад в
        направление. Любое изменение автоматически пересчитывает балл направления и Composite Score.
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${FILL_CLASS.filled}`}>
          заполнено {fillCounts.filled}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${FILL_CLASS["needs-source"]}`}>
          требует источника {fillCounts["needs-source"]}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${FILL_CLASS["needs-value"]}`}>
          требует значения {fillCounts["needs-value"]}
        </span>
      </div>


      {!hydrated ? (
        <p className="mt-3 text-[11px] text-paper/40">Загрузка таблицы…</p>
      ) : (
        <div className="mt-3 space-y-3">
          {DIRECTIONS.map((d) => {
            const dir = result.directions.find((r) => r.direction.code === d.code);
            const rows = dir?.indicators ?? [];
            return (
              <div key={d.code} className="rounded-2xl border border-white/10 bg-panel/50 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[10px] text-paper/40">{d.code}</span>
                  <span className="flex-1 truncate text-[11px] text-paper/80">{d.title}</span>
                  <span className="text-[10px] text-paper/40">
                    вес {((dir?.weight ?? 0) * 100).toFixed(1)}%
                  </span>
                  <span className="font-display text-[11px] text-cyan">
                    {num(dir?.score ?? null, 1)}
                  </span>
                </div>

                <div className="mt-2 space-y-1.5">
                  {rows.map((r) => (
                    <IndicatorRow
                      key={r.indicator.id}
                      indicator={byId.get(r.indicator.id) ?? (r.indicator as StoredIndicator)}
                      score={r.score}
                      contribution={r.contribution}
                      onChange={(patch) => update(r.indicator.id, patch)}
                      onRemove={() => remove(r.indicator.id)}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => add(d.code)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 py-1 text-[10px] text-paper/50"
                >
                  + Добавить показатель
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 rounded-2xl border border-white/10 bg-panel/50 p-2.5">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[11px] text-paper/75">
            Загрузка валидированного набора (30 записей)
          </span>
          <span className="text-[10px] text-paper/40">
            подтверждено {verifiedCount}/{indicators.length || 30} · без данных {missingCount}
          </span>
          <button
            type="button"
            onClick={() => setImportOpen((v) => !v)}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-paper/60"
          >
            {importOpen ? "Скрыть" : "Открыть"}
          </button>
        </div>

        {importOpen && (
          <div className="mt-2 space-y-2">
            <p className="text-[10px] leading-relaxed text-paper/40">
              JSON-массив записей: direction, slot, indicator_name, value, unit, year, source,
              source_url, normalized_score, data_status, missing_reason. Пустое значение — только со
              статусом «missing» и заполненной причиной; missing не считается нулём. Показатели
              вписываются в существующий каркас 10 × 3, веса 1/3 не меняются.
            </p>
            <textarea
              aria-label="JSON-массив записей показателей"
              className={`${inputClass} h-40 font-mono leading-relaxed`}
              value={importText}
              placeholder={IMPORT_TEMPLATE}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={importing}
                onClick={() => void runImport()}
                className="rounded-full border border-lime/30 bg-lime/10 px-2.5 py-1 text-[10px] text-lime disabled:opacity-50"
              >
                {importing ? "Загрузка…" : "Проверить и загрузить"}
              </button>
              <button
                type="button"
                onClick={() => setImportText(IMPORT_TEMPLATE)}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-paper/50"
              >
                Шаблон записи
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportErrors([]);
                  setImportNote(`Каркас сформирован из существующих записей: ${indicators.length}.`);
                  setImportText(buildImportSkeleton(indicators));
                }}
                className="rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 text-[10px] text-cyan"
              >
                Каркас 30 записей
              </button>
            </div>

            {importErrors.length > 0 && (
              <ul className="space-y-0.5 rounded-xl border border-pink/30 bg-pink/10 px-2.5 py-2 text-[10px] text-pink">
                {importErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            {importNote && (
              <p className="rounded-xl border border-lime/30 bg-lime/10 px-2.5 py-2 text-[10px] text-lime">
                {importNote}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
          <span className="text-[11px] text-paper/60">Composite Score</span>
          <span className="font-display text-[11px] text-paper/80">
            {result.compositeScore === null ? "ожидает данных" : num(result.compositeScore, 2)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
          <span className="text-[11px] text-paper/60">Покрытие весов данными</span>
          <span className="font-display text-[11px] text-paper/80">
            {(result.coverage * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
          <span className="text-[11px] text-paper/60">AI WORLD INDEX (база 2024 = 100)</span>
          <span className="font-display text-[11px] text-paper/80">
            {result.indexValue === null ? "ожидает полного набора" : num(result.indexValue, 2)}
          </span>
        </div>
      </div>
    </section>
  );
}
