/**
 * AI WORLD INDEX V1 — рабочий контур расчёта (операции методолога).
 *
 * Две операции, обе предусмотрены утверждённой методологией:
 *
 *  1. Референсные границы по правилу V1.0: L = P2.5, U = P97.5.
 *     Наблюдения reference dataset вносит методолог, перцентиль считает
 *     сервер детерминированно. Границы не выдумываются и не подставляются
 *     автоматически; статус правила остаётся pending до отдельного
 *     утверждения методологом.
 *
 *  2. Фиксация точки исторического ряда. Доступна ТОЛЬКО когда ядро
 *     вернуло complete = true и рассчитанное indexValue: неполный набор
 *     в ряд не попадает, отсутствующие данные нулём не заменяются.
 *
 * Формулы, веса 10 направлений, вес 1/3 внутри направления и базовый год
 * 2024 = 100 этим компонентом не затрагиваются.
 */

import { useState } from "react";
import { useAppendHistoryPoint, useIndexHistoryQuery } from "@/queries/history";
import { useComputeRuleBounds } from "@/queries/rules";
import { useIndexPipeline } from "@/lib/use-index-pipeline";
import { BOUNDS_RULE_V1 } from "@/lib/normalization-rules";

const numberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** Разбор строки наблюдений: числа через запятую, пробел или перевод строки. */
function parseObservations(input: string): number[] {
  return input
    .split(/[\s,;]+/)
    .map((token) => token.replace(",", ".").trim())
    .filter((token) => token.length > 0)
    .map(Number)
    .filter((value) => Number.isFinite(value));
}

export function CalcPanel() {
  const { rules, result, counts } = useIndexPipeline();
  const historyQuery = useIndexHistoryQuery();
  const computeBounds = useComputeRuleBounds();
  const appendPoint = useAppendHistoryPoint();

  const [ruleId, setRuleId] = useState("");
  const [observations, setObservations] = useState("");
  const [datasetLabel, setDatasetLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [boundsMessage, setBoundsMessage] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");

  const parsed = parseObservations(observations);
  const selected = rules.find((rule) => rule.id === ruleId);
  const canCompute = Boolean(ruleId) && parsed.length >= 2 && !computeBounds.isPending;

  const canFix =
    result.complete && result.indexValue !== null && result.compositeScore !== null;
  const points = historyQuery.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  async function submitBounds() {
    setBoundsMessage("");
    const response = await computeBounds.mutateAsync({
      id: ruleId,
      observations: parsed,
      ...(datasetLabel.trim() ? { datasetLabel: datasetLabel.trim() } : {}),
      ...(sourceUrl.trim() ? { referenceSourceUrl: sourceUrl.trim() } : {}),
    });

    if (!response.ok || !response.row) {
      setBoundsMessage(response.reason || "Границы не рассчитаны.");
      return;
    }
    setBoundsMessage(
      `L = ${numberFormat.format(response.row.minReference ?? 0)} · U = ${numberFormat.format(
        response.row.maxReference ?? 0,
      )} · n = ${parsed.length}. Правило остаётся pending до утверждения.`,
    );
    setObservations("");
  }

  async function fixPoint() {
    setHistoryMessage("");
    if (!canFix || result.indexValue === null || result.compositeScore === null) {
      setHistoryMessage("Набор данных неполный: индекс не рассчитан, точка не фиксируется.");
      return;
    }
    const response = await appendPoint.mutateAsync({
      observedOn: today,
      indexValue: result.indexValue,
      compositeScore: result.compositeScore,
      coverage: result.coverage,
      verifiedCount: counts.verified,
    });
    setHistoryMessage(
      response.ok
        ? `Точка ${today} зафиксирована: индекс ${numberFormat.format(result.indexValue)}.`
        : response.reason,
    );
  }

  return (
    <section className="mt-3 rounded-3xl border border-white/10 bg-panel/60 p-4">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-sm bg-cyan" />
        <h2 className="font-display text-sm font-semibold tracking-wide">Расчётные операции</h2>
      </div>

      {/* 1. Референсные границы по правилу V1.0 */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-ink/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xs font-semibold tracking-wide text-paper/80">
            Референсные границы
          </h3>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-paper/50">
            {BOUNDS_RULE_V1}
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-paper-muted">
          Границы L и U рассчитываются перцентилями из наблюдений reference dataset,
          внесённых методологом. Расчёт детерминирован, значения не додумываются.
        </p>

        <select
          value={ruleId}
          onChange={(event) => setRuleId(event.target.value)}
          aria-label="Правило нормализации для расчёта границ"
          className="mt-3 w-full rounded-2xl border border-white/10 bg-ink/60 px-3 py-2 text-xs text-paper outline-none"
        >
          <option value="">Выберите показатель</option>
          {rules.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.direction}.{rule.slot} {rule.indicatorName || "без названия"}
            </option>
          ))}
        </select>

        <textarea
          value={observations}
          onChange={(event) => setObservations(event.target.value)}
          rows={3}
          placeholder="Наблюдения reference dataset: 12.4, 15.1, 19.8, …"
          aria-label="Наблюдения reference dataset"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-ink/60 px-3 py-2 font-mono text-[11px] text-paper outline-none placeholder:text-paper/25"
        />
        <input
          value={datasetLabel}
          onChange={(event) => setDatasetLabel(event.target.value)}
          placeholder="Название reference dataset"
          aria-label="Название reference dataset"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-ink/60 px-3 py-2 text-xs text-paper outline-none placeholder:text-paper/25"
        />
        <input
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="Ссылка на reference dataset"
          aria-label="Ссылка на reference dataset"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-ink/60 px-3 py-2 text-xs text-paper outline-none placeholder:text-paper/25"
        />

        <div className="mt-2 flex items-center justify-between text-[10px] text-paper/40">
          <span>наблюдений распознано: {parsed.length}</span>
          {selected && <span>метод: {selected.method || "не задан"}</span>}
        </div>

        <button
          type="button"
          disabled={!canCompute}
          onClick={() => void submitBounds()}
          className="mt-2 w-full rounded-2xl border border-cyan/30 bg-cyan/10 px-3 py-2 text-xs font-semibold text-paper disabled:opacity-40"
        >
          {computeBounds.isPending ? "Расчёт…" : "Рассчитать L = P2.5 / U = P97.5"}
        </button>
        {boundsMessage && <p className="mt-2 text-[11px] text-paper/70">{boundsMessage}</p>}
      </div>

      {/* 2. Фиксация точки исторического ряда */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-ink/40 p-3">
        <h3 className="font-display text-xs font-semibold tracking-wide text-paper/80">
          Точка исторического ряда
        </h3>
        <p className="mt-2 text-[11px] leading-relaxed text-paper-muted">
          Точка записывается только по состоявшемуся расчёту на полном проверенном наборе
          (coverage = 100%). База методологии: 2024 = 100.
        </p>

        <div className="mt-3 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
            <span className="text-paper/60">Composite Score</span>
            <span className="text-paper/80">
              {result.compositeScore === null
                ? "нет данных"
                : numberFormat.format(result.compositeScore)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
            <span className="text-paper/60">Покрытие весов</span>
            <span className="text-paper/80">{(result.coverage * 100).toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
            <span className="text-paper/60">Точек в ряде</span>
            <span className="text-paper/80">{points.length}</span>
          </div>
        </div>

        <button
          type="button"
          disabled={!canFix || appendPoint.isPending}
          onClick={() => void fixPoint()}
          className="mt-2 w-full rounded-2xl border border-lime/30 bg-lime/10 px-3 py-2 text-xs font-semibold text-paper disabled:opacity-40"
        >
          {appendPoint.isPending ? "Фиксация…" : `Зафиксировать точку ${today}`}
        </button>
        {!canFix && (
          <p className="mt-2 text-[11px] text-paper/40">
            Недоступно: индекс не рассчитан на полном проверенном наборе данных.
          </p>
        )}
        {historyMessage && <p className="mt-2 text-[11px] text-paper/70">{historyMessage}</p>}
      </div>
    </section>
  );
}
