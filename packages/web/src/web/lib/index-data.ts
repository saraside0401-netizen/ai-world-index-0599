/**
 * AI WORLD INDEX — структура индекса.
 *
 * На следующем этапе сюда подключается собственная методика расчёта:
 * веса направлений, исходные данные и автоматический пересчёт значения.
 * Пока числовые значения индекса не публикуются — интерфейс использует
 * нейтральные плейсхолдеры.
 */

export type Accent = "cyan" | "violet" | "pink" | "lime" | "gold";

export interface Direction {
  code: string;
  title: string;
  subtitle: string;
  accent: Accent;
}

export const INDEX_NAME = "AI WORLD INDEX";

export const DIRECTIONS: Direction[] = [
  { code: "01", title: "Инвестиции и капитал", subtitle: "Потоки капитала", accent: "cyan" },
  { code: "02", title: "Технологии", subtitle: "Прогресс моделей", accent: "violet" },
  { code: "03", title: "Чипы и вычисления", subtitle: "Производство кремния", accent: "pink" },
  { code: "04", title: "Инфраструктура", subtitle: "Центры обработки данных", accent: "lime" },
  { code: "05", title: "Энергия", subtitle: "Спрос на электроэнергию", accent: "gold" },
  { code: "06", title: "Робототехника", subtitle: "Воплощённый AI", accent: "cyan" },
  { code: "07", title: "AI-бизнес", subtitle: "Выручка и продукты", accent: "violet" },
  { code: "08", title: "Распространение AI", subtitle: "Глобальное внедрение", accent: "pink" },
  { code: "09", title: "Экономическое влияние", subtitle: "Макроэффект", accent: "lime" },
  { code: "10", title: "Кадры и экосистема", subtitle: "Человеческий капитал", accent: "gold" },
];

export const DATA_SOURCES = [
  "Потоки рынков капитала",
  "Телеметрия вычислений и энергии",
  "Сигналы внедрения и экосистемы",
] as const;
