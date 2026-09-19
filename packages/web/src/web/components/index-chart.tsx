/**
 * Скелет графика динамики индекса.
 *
 * Иллюстративная геометрия исходного прототипа удалена намеренно: ряд
 * динамики не публикуется, пока индекс не рассчитан на полном проверенном
 * наборе данных. Пока точек нет, отображается пустая сетка, а не выдуманные
 * столбцы. Реальный ряд передаётся пропом `series` без изменения разметки.
 */

const BAR_CLASS: Record<string, string> = {
  cyan: "from-cyan/10 to-cyan/50",
  violet: "from-violet/10 to-violet/50",
  pink: "from-pink/10 to-pink/50",
  lime: "from-lime/10 to-lime/50",
  gold: "from-gold/10 to-gold/50",
};

/** Число позиций пустой сетки — только геометрия, без значений. */
const SLOT_COUNT = 12;

export type IndexChartBar = { h: number; accent: keyof typeof BAR_CLASS; label?: string };

export function IndexChart({ series }: { series?: IndexChartBar[] }) {
  const bars = series ?? [];
  const hasSeries = bars.length > 0;

  return (
    <section className="mt-4 rounded-3xl border border-white/10 bg-panel/70 p-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-display text-sm font-semibold tracking-wide">Динамика индекса</h2>
        <div className="flex gap-1">
          <span className="rounded-full bg-cyan/15 px-2 py-0.5 text-[10px] text-cyan">1М</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] text-paper/40">3М</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] text-paper/40">1Г</span>
        </div>
      </div>

      {hasSeries ? (
        <div className="mt-4 flex h-36 items-end gap-1.5">
          {bars.map((bar, i) => (
            <div
              key={bar.label ?? i}
              style={{ height: `${bar.h}%` }}
              className={`flex-1 rounded-t bg-gradient-to-t ${BAR_CLASS[bar.accent]}`}
            />
          ))}
        </div>
      ) : (
        <div className="relative mt-4 h-36 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          {/* Пустая сетка: горизонтальные уровни и слоты без значений. */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-px w-full bg-white/5" />
            ))}
          </div>
          <div className="absolute inset-0 flex items-end gap-1.5 px-1 pb-px">
            {Array.from({ length: SLOT_COUNT }).map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-t bg-white/10" />
            ))}
          </div>
          <div className="absolute inset-0 grid place-items-center">
            <span className="rounded-full border border-white/10 bg-panel/80 px-3 py-1 text-[10px] text-paper/45">
              Ряд не рассчитан
            </span>
          </div>
        </div>
      )}

      <div className="mt-2 flex justify-between font-display text-[9px] text-paper/30">
        <span>Н1</span>
        <span>Н3</span>
        <span>Н5</span>
        <span>Н7</span>
        <span>Н9</span>
        <span>Н11</span>
      </div>
      <p className="mt-3 px-1 text-[11px] text-paper/40">
        {hasSeries
          ? "Ряд построен по рассчитанным значениям индекса."
          : "Точки ряда не публикуются до расчёта индекса на полном проверенном наборе данных."}
      </p>
    </section>
  );
}
