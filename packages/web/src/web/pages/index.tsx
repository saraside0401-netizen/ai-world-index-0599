/**
 * Главная страница AI WORLD INDEX — перенос разметки исходного прототипа.
 * Текст, структура блоков и мобильная ширина 390px сохранены без изменений.
 */

import { AdminGatePanel, AdminWritable } from "../components/admin-gate";
import { CalcPanel } from "../components/calc-panel";
import { DataSection } from "../components/data-section";
import { IndexChart } from "../components/index-chart";
import { IndexCore } from "../components/index-core";
import { NormalizationRulesSection } from "../components/normalization-rules-section";

import { DATA_SOURCES, DIRECTIONS, INDEX_NAME, type Accent } from "@/lib/index-data";
import { useAdminUnlocked } from "@/lib/use-admin-gate";
import { toChartBars } from "@/lib/history-series";
import { useIndexHistoryQuery } from "@/queries/history";

const BADGE_CLASS: Record<Accent, string> = {
  cyan: "from-cyan/30 to-cyan/5 text-cyan",
  violet: "from-violet/30 to-violet/5 text-violet",
  pink: "from-pink/30 to-pink/5 text-pink",
  lime: "from-lime/30 to-lime/5 text-lime",
  gold: "from-gold/30 to-gold/5 text-gold",
};

function Index() {
  const adminUnlocked = useAdminUnlocked();
  // Ряд строится только по зафиксированным расчётам; пустой ряд — пустой график.
  const historyQuery = useIndexHistoryQuery();
  const series = toChartBars(historyQuery.data ?? []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink pb-10 text-paper">
      <div className="pointer-events-none absolute -top-24 -left-20 size-72 rounded-full bg-cyan/20 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-24 size-72 rounded-full bg-pink/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-1/4 size-64 rounded-full bg-violet/20 blur-3xl" />

      <div className="relative mx-auto max-w-[390px] px-4">
        <header className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <div className="metal gloss grid size-7 place-items-center rounded-md">
              <span className="font-display text-xs font-bold text-ink">AI</span>
            </div>
            <span className="font-display text-sm font-semibold tracking-wide">{INDEX_NAME}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-panel/60 px-2.5 py-1">
            <span className="size-1.5 animate-pulse rounded-full bg-lime" />
            <span className="text-[10px] tracking-[0.15em] text-paper/60 uppercase">Live</span>
          </div>
        </header>

        {/* Текущее значение индекса */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-panel gloss p-5 shadow-[var(--shadow-hero)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/60 to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] tracking-[0.2em] text-paper/50 uppercase">
              Текущее значение
            </span>
            <span className="text-[11px] text-paper/40">v0 · превью</span>
          </div>
          <h1 className="text-gradient-cyan mt-3 font-display text-6xl leading-none font-bold">
            —.—
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-panel2 px-3 py-1 text-xs text-paper/70">
              <span className="size-1.5 rounded-full bg-white/40" />
              Изменение: ожидается расчёт
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-paper/45">
            Глобальная мера состояния и динамики экономики искусственного интеллекта. Значения,
            изменения и веса подключаются к собственному расчётному модулю.
          </p>
        </section>

        <IndexChart series={series} />

        {/* Направления */}
        <div className="mt-6 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold tracking-wide">Направления индекса</h2>
          <span className="text-[10px] text-paper/40">10 / 10</span>
        </div>
        <section className="mt-3 grid grid-cols-2 gap-2.5">
          {DIRECTIONS.map((d) => (
            <article key={d.code} className="gloss rounded-2xl border border-white/10 bg-panel p-3">
              <div
                className={`grid size-8 place-items-center rounded-lg bg-gradient-to-br font-display text-xs font-bold ${BADGE_CLASS[d.accent]}`}
              >
                {d.code}
              </div>
              <p className="mt-2 text-[13px] leading-tight font-medium">{d.title}</p>
              <p className="mt-1 text-[10px] text-paper/40">{d.subtitle}</p>
            </article>
          ))}
        </section>

        <button
          type="button"
          className="metal gloss mt-6 h-14 w-full rounded-2xl border border-white/40 font-display text-base font-bold tracking-wide text-ink shadow-[var(--shadow-cta)]"
        >
          Инвестировать
        </button>

        {/* Методология */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-panel/60 p-4">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-sm bg-cyan" />
            <h2 className="font-display text-sm font-semibold tracking-wide">Методология</h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-paper/55">
            Индекс — взвешенная композиция десяти направлений экономики AI, нормализованных и
            автоматически пересчитываемых. Веса, исходные данные и расчётная модель подключаются на
            следующем этапе.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["Веса", "Нормализация", "Автоматический расчёт"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-paper/50"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        <IndexCore />

        <AdminGatePanel />

        <AdminWritable unlocked={adminUnlocked}>
          <CalcPanel />

          <DataSection />

          <NormalizationRulesSection />
        </AdminWritable>

        {/* Источники данных */}
        <section className="mt-3 rounded-3xl border border-white/10 bg-panel/60 p-4">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-sm bg-pink" />
            <h2 className="font-display text-sm font-semibold tracking-wide">Источники данных</h2>
          </div>
          <div className="mt-3 space-y-2">
            {DATA_SOURCES.map((source) => (
              <div key={source} className="flex items-center justify-between text-xs">
                <span className="text-paper/70">{source}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-paper/40">
                  Ожидается
                </span>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-5 text-center text-[10px] tracking-wide text-paper/30">
          AI WORLD INDEX · Прототип v1 · Реальные значения не публикуются
        </p>
      </div>
    </div>
  );
}

export default Index;
