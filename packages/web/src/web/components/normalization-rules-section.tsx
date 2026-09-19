/**
 * Раздел «Правила нормализации» — управление правилами для 30 показателей.
 *
 * Значения min/max, метод и полярность вносятся вручную методологом.
 * Ничего не подставляется автоматически, правила не утверждаются сами:
 * подтверждение статуса «approved» — только явное действие пользователя.
 */

import { useMemo, useState } from "react";
import { DIRECTIONS } from "@/lib/index-data";
import {
  BOUNDS_RULE_V1,
  isRuleApproved,
  useNormalizationRules,
  type NormalizationRule,
} from "@/lib/normalization-rules";
import { RULES_IMPORT_TEMPLATE, parseRuleRecords } from "@/lib/normalization-rules-import";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-paper/85 outline-none placeholder:text-paper/25 focus:border-cyan/40";

const METHODS = ["", "minmax", "log-minmax", "zscore-clamped", "manual"];
const POLARITIES = ["", "positive", "negative"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[9px] tracking-wide text-paper/35 uppercase">{label}</span>
      {children}
    </label>
  );
}

type Patch = Partial<Omit<NormalizationRule, "id" | "direction" | "slot">>;

/**
 * Префикс пометки о недоступности свободного источника референсного набора.
 * Ставится загрузчиком `scripts/load-reference-bounds.ts`; границы L/U при
 * этом остаются пустыми — значения не выдумываются.
 */
const DATA_GAP_PREFIX = "DATA GAP: ";

/**
 * Перечень незаполненных обязательных полей правила.
 * Ничего не подставляет — только показывает, чего не хватает для подтверждения.
 */
function ruleGaps(rule: NormalizationRule): string[] {
  const gaps: string[] = [];
  if (!rule.method) gaps.push("метод нормализации");
  if (!rule.polarity) gaps.push("полярность");
  if (!rule.referenceDataset) gaps.push("reference dataset / источник");
  if (!rule.referenceSourceUrl) gaps.push("прямой URL reference dataset");
  const needsRefs = rule.method === "minmax" || rule.method === "log-minmax";
  if (needsRefs) {
    if (rule.minReference === null) gaps.push("min = L (P2.5)");
    if (rule.maxReference === null) gaps.push("max = U (P97.5)");
    if (
      rule.minReference !== null &&
      rule.maxReference !== null &&
      rule.minReference >= rule.maxReference
    ) {
      gaps.push("min должен быть меньше max");
    }
  }
  return gaps;
}

/** Правило заполнено методологом и готово к ручной проверке. */
const isRuleFilled = (rule: NormalizationRule) => ruleGaps(rule).length === 0;

function RuleRow({
  rule,
  defaultOpen,
  onChange,
}: {
  rule: NormalizationRule;
  defaultOpen?: boolean;
  onChange: (patch: Patch) => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const approved = isRuleApproved(rule);
  const gaps = ruleGaps(rule);


  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
      >
        <span className="flex-1 truncate text-[11px] text-paper/75">
          {rule.indicatorName || "Показатель не заполнен"}
        </span>
        <span className="text-[10px] text-paper/35">{rule.method || "метод не задан"}</span>
        {rule.note.startsWith(DATA_GAP_PREFIX) && (
          <span
            title={rule.note}
            className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] text-amber-200"
          >
            data gap
          </span>
        )}
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[9px] ${
            approved
              ? "border-lime/30 bg-lime/10 text-lime"
              : gaps.length === 0
                ? "border-cyan/25 bg-cyan/10 text-cyan"
                : "border-white/10 bg-white/5 text-paper/40"
          }`}
        >
          {approved ? "утверждено" : gaps.length === 0 ? "к проверке" : "нет данных"}
        </span>

        <span className="text-[10px] text-paper/30">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-white/10 px-2.5 py-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Метод нормализации">
              <select
                aria-label="Метод нормализации"
                className={inputClass}
                value={rule.method}
                onChange={(e) => onChange({ method: e.target.value })}
              >
                {METHODS.map((m) => (
                  <option key={m || "none"} value={m} className="bg-panel text-paper">
                    {m || "не задан"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Полярность">
              <select
                aria-label="Полярность"
                className={inputClass}
                value={rule.polarity}
                onChange={(e) => onChange({ polarity: e.target.value })}
              >
                {POLARITIES.map((p) => (
                  <option key={p || "none"} value={p} className="bg-panel text-paper">
                    {p || "не задана"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Min = L (P2.5)">
              <input
                aria-label="Min = L (P2.5)"
                className={inputClass}
                inputMode="decimal"
                value={rule.minReference ?? ""}
                placeholder="пусто"
                onChange={(e) => {
                  const v = e.target.value.trim().replace(",", ".");
                  const n = v === "" ? null : Number(v);
                  onChange({ minReference: n === null || !Number.isFinite(n) ? null : n });
                }}
              />
            </Field>
            <Field label="Max = U (P97.5)">
              <input
                aria-label="Max = U (P97.5)"
                className={inputClass}
                inputMode="decimal"
                value={rule.maxReference ?? ""}
                placeholder="пусто"
                onChange={(e) => {
                  const v = e.target.value.trim().replace(",", ".");
                  const n = v === "" ? null : Number(v);
                  onChange({ maxReference: n === null || !Number.isFinite(n) ? null : n });
                }}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Field label="Reference dataset / источник">
              <input
                aria-label="Reference dataset / источник"
                className={inputClass}
                value={rule.referenceDataset}
                placeholder="пусто"
                onChange={(e) => onChange({ referenceDataset: e.target.value })}
              />
            </Field>
            <Field label="Прямой URL reference dataset">
              <input
                aria-label="Прямой URL reference dataset"
                className={inputClass}
                value={rule.referenceSourceUrl}
                placeholder="пусто"
                onChange={(e) => onChange({ referenceSourceUrl: e.target.value })}
              />
            </Field>
            <Field label="Правило границ V1.0">
              <input
                aria-label="Правило границ V1.0"
                className={inputClass}
                value={rule.boundsRule}
                placeholder={BOUNDS_RULE_V1}
                onChange={(e) => onChange({ boundsRule: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Примечание">
            <input
              aria-label="Примечание"
              className={inputClass}
              value={rule.note}
              placeholder="пусто"
              onChange={(e) => onChange({ note: e.target.value })}
            />
          </Field>

          {gaps.length > 0 ? (
            <ul className="space-y-0.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-[10px] text-paper/45">
              <li className="text-paper/60">Не хватает для подтверждения:</li>
              {gaps.map((g) => (
                <li key={g}>— {g}</li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-cyan/25 bg-cyan/10 px-2.5 py-2 text-[10px] text-cyan">
              Поля заполнены. Проверьте значения и подтвердите правило вручную.
            </p>
          )}

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-paper/40">Статус: {rule.status || "pending"}</span>
            {approved ? (
              <button
                type="button"
                onClick={() => onChange({ status: "pending" })}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-paper/50"
              >
                Снять подтверждение
              </button>
            ) : (
              <button
                type="button"
                disabled={gaps.length > 0}
                onClick={() => onChange({ status: "approved" })}
                className="rounded-full border border-lime/30 bg-lime/10 px-2 py-0.5 text-[10px] text-lime disabled:cursor-not-allowed disabled:opacity-40"
              >
                Подтвердить правило
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

export function NormalizationRulesSection() {
  const { rules, hydrated, approved, pending, updateRule } = useNormalizationRules();

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importNote, setImportNote] = useState("");
  const [importing, setImporting] = useState(false);

  /** Шаблон строится из уже существующих 30 правил, без подстановки значений. */
  const currentTemplate = useMemo(
    () =>
      JSON.stringify(
        rules.map((r) => ({
          direction: r.direction,
          slot: r.slot,
          indicator_name: r.indicatorName,
          normalization_method: r.method,
          min_reference: r.minReference,
          max_reference: r.maxReference,
          polarity: r.polarity,
          status: r.status || "pending",
          reference_dataset: r.referenceDataset,
          reference_source_url: r.referenceSourceUrl,
          bounds_rule: r.boundsRule || BOUNDS_RULE_V1,
          note: r.note,
        })),
        null,
        2,
      ),
    [rules],
  );

  const runImport = async () => {
    setImportNote("");
    const { records, errors } = parseRuleRecords(importText);
    if (errors.length) {
      setImportErrors(errors);
      return;
    }
    setImportErrors([]);

    const index = new Map(rules.map((r) => [`${r.direction}#${r.slot}`, r]));
    const missing = records
      .filter((rec) => !index.has(`${rec.direction}#${rec.slot}`))
      .map((rec) => `нет правила для направления ${rec.direction}, slot ${rec.slot}`);
    if (missing.length) {
      setImportErrors(missing);
      return;
    }

    setImporting(true);
    for (const rec of records) {
      const target = index.get(`${rec.direction}#${rec.slot}`)!;
      const patch: Patch = {
        method: rec.method,
        minReference: rec.minReference,
        maxReference: rec.maxReference,
        polarity: rec.polarity,
        status: rec.status,
        note: rec.note,
        referenceDataset: rec.referenceDataset,
        referenceSourceUrl: rec.referenceSourceUrl,
        boundsRule: rec.boundsRule,
      };
      if (rec.indicatorName) patch.indicatorName = rec.indicatorName;
      await updateRule(target.id, patch);
    }
    setImporting(false);
    setImportNote(`Загружено правил: ${records.length}.`);
  };

  const [reviewOnly, setReviewOnly] = useState(false);
  const filledCount = useMemo(() => rules.filter(isRuleFilled).length, [rules]);

  const byDirection = useMemo(() => {
    const map = new Map<string, NormalizationRule[]>();
    for (const r of rules) {
      const list = map.get(r.direction) ?? [];
      list.push(r);
      map.set(r.direction, list);
    }
    return map;
  }, [rules]);


  return (
    <section id="normalization" className="mt-3 rounded-3xl border border-white/10 bg-panel/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-sm bg-violet" />
          <h2 className="font-display text-sm font-semibold tracking-wide">Правила нормализации</h2>
        </div>
        <span className="text-[10px] text-paper/40">
          утверждено {approved}/{rules.length} · ожидает {pending}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-paper/55">
        Правило V1.0: min = L = P2.5, max = U = P97.5 от утверждённого reference dataset. Границы,
        источник набора и прямой URL вносятся вручную согласно утверждённой методологии.
        Значения не подставляются автоматически: пока правило не подтверждено, показатель не получает
        normalized_score.
      </p>

      <div className="mt-3 rounded-2xl border border-white/10 bg-panel/50 p-2.5">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[11px] text-paper/75">
            Загрузка утверждённых правил (30 записей)
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
              JSON-массив правил: direction, slot, indicator_name, normalization_method,
              min_reference (L = P2.5), max_reference (U = P97.5), reference_dataset,
              reference_source_url, bounds_rule, polarity, status, note. Правила сопоставляются с
              существующими 30 записями по direction и slot. Значения min/max не подставляются:
              статус approved допускается только при заполненном методе, полярности и требуемых
              референсах.
            </p>
            <textarea
              aria-label="JSON-массив правил нормализации"
              className={`${inputClass} h-40 font-mono leading-relaxed`}
              value={importText}
              placeholder={RULES_IMPORT_TEMPLATE}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => setImportText(RULES_IMPORT_TEMPLATE)}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-paper/50"
              >
                Шаблон записи
              </button>
              <button
                type="button"
                onClick={() => setImportText(currentTemplate)}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-paper/50"
              >
                Выгрузить текущие 30
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

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setReviewOnly((v) => !v)}
          className={`rounded-full border px-2.5 py-1 text-[10px] ${
            reviewOnly
              ? "border-cyan/30 bg-cyan/10 text-cyan"
              : "border-white/10 bg-white/5 text-paper/50"
          }`}
        >
          Только заполненные правила ({filledCount})
        </button>
        <span className="text-[10px] text-paper/35">
          {reviewOnly ? "показаны правила, готовые к ручной проверке" : "показаны все 30 правил"}
        </span>
      </div>

      {!hydrated ? (
        <p className="mt-3 text-[11px] text-paper/40">Загрузка правил…</p>
      ) : (
        <div className="mt-3 space-y-3">
          {DIRECTIONS.map((d) => {
            const all = byDirection.get(d.code) ?? [];
            const rows = reviewOnly ? all.filter(isRuleFilled) : all;
            const dirApproved = all.filter(isRuleApproved).length;
            if (reviewOnly && rows.length === 0) return null;
            return (
              <div key={d.code} className="rounded-2xl border border-white/10 bg-panel/50 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[10px] text-paper/40">{d.code}</span>
                  <span className="flex-1 truncate text-[11px] text-paper/80">{d.title}</span>
                  <span className="text-[10px] text-paper/40">
                    {dirApproved}/{all.length}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {rows.map((r) => (
                    <RuleRow
                      key={r.id}
                      rule={r}
                      defaultOpen={reviewOnly}
                      onChange={(patch) => void updateRule(r.id, patch)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {reviewOnly && filledCount === 0 && (
            <p className="text-[11px] text-paper/40">
              Пока нет правил с полностью заполненными полями — значения не подставляются
              автоматически.
            </p>
          )}
        </div>

      )}
    </section>
  );
}
