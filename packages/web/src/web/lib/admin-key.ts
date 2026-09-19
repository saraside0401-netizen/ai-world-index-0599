/**
 * AI WORLD INDEX V1 — хранение ключа методолога на клиенте.
 *
 * Ключ не участвует в расчёте и не влияет на методологию: он только открывает
 * запись. Проверяется всегда на сервере (`x-admin-key`), клиент лишь помнит
 * введённое значение между перезагрузками страницы.
 */

const STORAGE_KEY = "aiwi.admin-key";

type Listener = (key: string) => void;
const listeners = new Set<Listener>();

/** Текущий ключ или пустая строка, если контур заблокирован. */
export function readAdminKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Сохранить ключ (пустая строка — заблокировать контур). */
export function writeAdminKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    if (key) window.localStorage.setItem(STORAGE_KEY, key);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // приватный режим браузера — ключ живёт только до перезагрузки
  }
  for (const listener of listeners) listener(key);
}

/** Подписка на изменение состояния контура. */
export function subscribeAdminKey(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
