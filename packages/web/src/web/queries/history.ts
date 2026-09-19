/**
 * Запросы исторического ряда AI WORLD INDEX (таблица `index_history`).
 *
 * Ряд содержит только состоявшиеся расчёты. Пустой ответ — корректное
 * состояние, означающее, что индекс ещё не рассчитывался.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function useIndexHistoryQuery() {
  return useQuery(orpc.history.list.queryOptions());
}

export function useAppendHistoryPoint() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.history.append.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.history.key() }),
    }),
  );
}
