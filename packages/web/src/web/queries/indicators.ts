/**
 * Запросы и мутации показателей AI WORLD INDEX (таблица `index_indicators`).
 *
 * Единственная точка обращения интерфейса к API показателей.
 * Бизнес-логика здесь не живёт: расчёт — в `lib/index-core.ts`,
 * вывод служебных полей строки — на сервере в `api/routes/indicators.ts`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** Список из 30 строк каркаса, упорядоченный по направлению и слоту. */
export function useIndicatorsQuery() {
  return useQuery(orpc.indicators.list.queryOptions());
}

/** Сброс кеша списка после любой записи. */
function useInvalidateIndicators() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.indicators.key() });
}

export function useUpdateIndicator() {
  const invalidate = useInvalidateIndicators();
  return useMutation(orpc.indicators.update.mutationOptions({ onSuccess: invalidate }));
}

export function usePersistScores() {
  const invalidate = useInvalidateIndicators();
  return useMutation(orpc.indicators.persistScores.mutationOptions({ onSuccess: invalidate }));
}

export function useImportIndicatorRecords() {
  const invalidate = useInvalidateIndicators();
  return useMutation(orpc.indicators.importRecords.mutationOptions({ onSuccess: invalidate }));
}

export function useAddIndicator() {
  const invalidate = useInvalidateIndicators();
  return useMutation(orpc.indicators.add.mutationOptions({ onSuccess: invalidate }));
}

export function useRemoveIndicator() {
  const invalidate = useInvalidateIndicators();
  return useMutation(orpc.indicators.remove.mutationOptions({ onSuccess: invalidate }));
}

export function useResetIndicators() {
  const invalidate = useInvalidateIndicators();
  return useMutation(orpc.indicators.reset.mutationOptions({ onSuccess: invalidate }));
}
