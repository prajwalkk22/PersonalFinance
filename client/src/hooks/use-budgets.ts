import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { QUERY_KEYS } from "@/lib/queryKeys";

/* ================= LIST ================= */

export function useBudgets() {
  return useQuery({
    queryKey: QUERY_KEYS.BUDGETS,
    queryFn: async () => {
      const res = await fetch(api.budgets.list.path, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch budgets");

      return api.budgets.list.responses[200].parse(
        await res.json()
      );
    },
  });
}

/* ================= CREATE ================= */

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.budgets.create.path, {
        method: api.budgets.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to create budget");

      return api.budgets.create.responses[201].parse(
        await res.json()
      );
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BUDGETS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
    },
  });
}

/* ================= UPDATE ================= */

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number }) => {
      const url = buildUrl(api.budgets.update.path, { id });

      const res = await fetch(url, {
        method: api.budgets.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update budget");

      return api.budgets.update.responses[200].parse(
        await res.json()
      );
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BUDGETS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
    },
  });
}

/* ================= DELETE ================= */

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.budgets.delete.path, { id });

      const res = await fetch(url, {
        method: api.budgets.delete.method,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to delete budget");
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BUDGETS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
    },
  });
}
