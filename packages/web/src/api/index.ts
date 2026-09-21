import type { RouterClient } from "@orpc/server";
import { createApp } from "./__core/app";
import { initDatabase } from "./database/init";
import { admin } from "./routes/admin";
import { history } from "./routes/history";
import { indicators } from "./routes/indicators";
import { ping } from "./routes/ping";
import { rules } from "./routes/rules";

// API features are oRPC procedures, one file per feature in ./routes/,
// composed into this router — typed end-to-end via the clients
// (web: src/web/lib/api.ts, mobile: lib/api.ts).
// Keep each routes/ file under 500 lines (`bun run lint` enforces this);
// split into more feature files as they grow.
// Patterns and examples: skills/app/references/api.md
export const router = {
  ping,
  /** Контур методолога: статус ключа и его проверка. */
  admin,
  /** AI WORLD INDEX V1: показатели и правила нормализации. */
  indicators,
  rules,
  /** Исторический ряд индекса (только состоявшиеся расчёты). */
  history,
};

export type AppRouter = typeof router;
/** Typed client for the router — used by the web and mobile api clients. */
export type AppRouterClient = RouterClient<AppRouter>;

const app = createApp(router);

// Автосоздание таблиц и каркаса 10 × 3 при первом обращении к API.
// Работает и в dev (hono-dev-plugin), и в production (server.ts).
let initPromise: Promise<void> | null = null;
app.use("/api/*", async (_c, next) => {
  if (!initPromise) initPromise = initDatabase().catch((err) => { initPromise = null; throw err; });
  await initPromise;
  await next();
});

export default app;
