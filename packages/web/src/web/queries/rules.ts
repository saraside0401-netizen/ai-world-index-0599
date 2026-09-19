/**
 * Запросы и мутации правил нормализации AI WORLD INDEX
 * (таблица `normalization_rules`).
 *
 * Правило применяется к расчёту только при status = "approved" —
 * проверка живёт в `lib/normalization-pipeline.ts`, не здесь.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** Список из 30 правил, упорядоченный по направлению и слоту. */
export function useRulesQuery() {
  return useQuery(orpc.rules.list.queryOptions());
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.rules.update.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.rules.key() }),
    }),
  );
}

/** Расчёт референсных границ L = P2.5 / U = P97.5 из reference dataset. */
export function useComputeRuleBounds() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.rules.computeBounds.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.rules.key() }),
    }),
  );
}
