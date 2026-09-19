/**
 * AI WORLD INDEX V1 — состояние контура методолога в интерфейсе.
 *
 * Чтение индекса, показателей и правил открыто всем. Запись возможна только
 * после разблокировки ключом, который проверяет сервер (`admin.verify`).
 * На методологию контур не влияет.
 */

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { client } from "./api";
import { readAdminKey, subscribeAdminKey, writeAdminKey } from "./admin-key";

/** Текущий ключ методолога (пустая строка — контур заблокирован). */
export function useAdminKey(): string {
  const [key, setKey] = useState<string>(() => readAdminKey());
  useEffect(() => subscribeAdminKey(setKey), []);
  return key;
}

/** Разблокирован ли контур записи. */
export function useAdminUnlocked(): boolean {
  return useAdminKey().length > 0;
}

export interface AdminGate {
  unlocked: boolean;
  checking: boolean;
  error: string;
  unlock: (key: string) => Promise<boolean>;
  lock: () => void;
}

/** Форма разблокировки: проверка ключа на сервере и его запоминание. */
export function useAdminGate(): AdminGate {
  const unlocked = useAdminUnlocked();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const unlock = useCallback(
    async (candidate: string) => {
      const key = candidate.trim();
      if (!key) {
        setError("Введите ключ методолога.");
        return false;
      }

      setChecking(true);
      setError("");
      try {
        const { ok } = await client.admin.verify({ key });
        if (!ok) {
          setError("Ключ не принят сервером.");
          return false;
        }
        writeAdminKey(key);
        await queryClient.invalidateQueries();
        return true;
      } catch {
        setError("Не удалось проверить ключ: сервер недоступен.");
        return false;
      } finally {
        setChecking(false);
      }
    },
    [queryClient],
  );

  const lock = useCallback(() => {
    writeAdminKey("");
    setError("");
  }, []);

  return { unlocked, checking, error, unlock, lock };
}
