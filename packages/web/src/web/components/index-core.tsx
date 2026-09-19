/**
 * Раздел «Расчётное ядро V1» — перенос 1:1 из исходного проекта.
 * Логика, формулы и веса не изменялись: компонент только отображает
 * фактическое состояние расчётного контура `useIndexPipeline()`.
 */

import { BASE_YEAR, BASE_YEAR_VALUE, validateDirectionWeights } from "@/lib/index-core";
import { useIndexPipeline } from "@/lib/use-index-pipeline";

const pct = (v: number) => `${(v * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
const num = (v: number | null, digits = 1) =>
  v === null || !Number.isFinite(v) ? "—" : v.toFixed(digits);

export function IndexCore() {
  const { result, counts, rulesSummary, checks } = useIndexPipeline();
  const check = validateDirectionWeights();

  // Этапы расчётного контура отражают фактическое состояние данных.
  const stages: { label: string; value: string; ok: boolean }[] = [
    { label: "DATA", value: `${counts.total}/30`, ok: counts.total === 30 },
    { label: "VERIFIED", value: `${counts.verified}/${counts.total}`, ok: counts.verified > 0 },
    {
      label: "NORMALIZED",
      value: `${counts.normalized}/${counts.verified}`,
      ok: counts.verified > 0 && counts.normalized === counts.verified,
    },
    {
      label: "INDICATOR SCORE",
      value: `${counts.normalized} показ.`,
      ok: counts.normalized > 0,
    },
    {
      label: "DIRECTION SCORE",
      value: `${result.directions.filter((d) => d.score !== null).length}/10`,
      ok: result.directions.some((d) => d.score !== null),
    },
    {
      label: "COMPOSITE SCORE",
      value: result.compositeScore === null ? "нет данных" : num(result.compositeScore, 2),
      ok: result.compositeScore !== null,
    },
    {
      label: "AI WORLD INDEX",
      value: result.indexValue === null ? "ожидает полного набора" : num(result.indexValue, 2),
      ok: result.indexValue !== null,
    },
  ];

  return (
    <section className="mt-3 rounded-3xl border border-white/10 bg-panel/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-sm bg-violet" />
          <h2 className="font-display text-sm font-semibold tracking-wide">Расчётное ядро V1</h2>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] ${
            check.valid
              ? "border-lime/30 bg-lime/10 text-lime"
              : "border-pink/30 bg-pink/10 text-pink"
          }`}
        >
          Σ весов {pct(check.sum)}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-paper/55">
        Цепочка: исходные данные → нормализация 0–100 по утверждённым правилам → балл направления →
        вес направления → итоговый индекс. Базовый год {BASE_YEAR} = {BASE_YEAR_VALUE} после загрузки
        полного проверенного набора данных.
      </p>

      <div className="mt-3 space-y-1">
        {stages.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5"
          >
            <span className={`size-1.5 rounded-full ${s.ok ? "bg-lime" : "bg-white/25"}`} />
            <span className="flex-1 font-display text-[10px] tracking-wide text-paper/60">
              {s.label}
            </span>
            <span className="text-[10px] text-paper/70">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        {result.directions.map((d) => (
          <div
            key={d.direction.code}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5"
          >
            <span className="font-display text-[10px] text-paper/40">{d.direction.code}</span>
            <span className="flex-1 truncate text-[11px] text-paper/75">{d.direction.title}</span>
            <span className="font-display text-[11px] text-cyan">{pct(d.weight)}</span>
            <span className="w-16 text-right text-[10px] text-paper/40">
              {d.score === null ? "нет данных" : num(d.score, 1)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
        <span className="text-[11px] text-paper/60">Verified / Missing</span>
        <span className="font-display text-[11px] text-paper/80">
          {counts.verified} / {counts.missing}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
        <span className="text-[11px] text-paper/60">Normalized coverage</span>
        <span className="font-display text-[11px] text-paper/80">
          {counts.normalized}/{counts.total} · {pct(counts.normalizedCoverage)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
        <span className="text-[11px] text-paper/60">Покрытие весов данными</span>
        <span className="font-display text-[11px] text-paper/80">{pct(result.coverage)}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
        <span className="text-[11px] text-paper/60">Правила нормализации утверждены</span>
        <span className="font-display text-[11px] text-paper/80">
          {rulesSummary.approved}/{rulesSummary.total || 30}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
        <span className="text-[11px] text-paper/60">Composite Score (промежуточный)</span>
        <span className="font-display text-[11px] text-paper/80">
          {result.compositeScore === null ? "ожидает данных" : num(result.compositeScore, 2)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
        <span className="text-[11px] text-paper/60">AI WORLD INDEX (база {BASE_YEAR} = 100)</span>
        <span className="font-display text-[11px] text-paper/80">
          {result.indexValue === null ? "ожидает полного набора" : num(result.indexValue, 2)}
        </span>
      </div>

      <div className="mt-3 space-y-1">
        {checks.map((c) => (
          <div
            key={c.label}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5"
          >
            <span className={`size-1.5 rounded-full ${c.ok ? "bg-lime" : "bg-pink"}`} />
            <span className="flex-1 text-[10px] text-paper/60">{c.label}</span>
            <span className="text-[10px] text-paper/35">{c.detail}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-paper/35">
        Балл 0–100 рассчитывается только для подтверждённых значений при утверждённом правиле
        нормализации (метод, референсные границы, полярность). Отсутствующие показатели не
        участвуют в расчёте и не приравниваются к нулю.
      </p>
    </section>
  );
}
