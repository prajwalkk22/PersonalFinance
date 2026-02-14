import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertTransaction } from "@shared/routes";

export function useTransactions(filters?: { month?: string; year?: string; category?: string }) {
  const queryString = filters ? `?${new URLSearchParams(filters as any).toString()}` : '';
  
  return useQuery({
    queryKey: [api.transactions.list.path, filters],
    queryFn: async () => {
      const res = await fetch(api.transactions.list.path + queryString, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return api.transactions.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertTransaction) => {
      const res = await fetch(api.transactions.create.path, {
        method: api.transactions.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create transaction");
      return api.transactions.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.analytics.dashboard.path] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.transactions.delete.path, { id });
      const res = await fetch(url, { 
        method: api.transactions.delete.method,
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to delete transaction");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.analytics.dashboard.path] });
    },
  });
}

export function useCategorizeTransaction() {
  return useMutation({
    mutationFn: async (data: { description: string; amount?: number }) => {
      const res = await fetch(api.ai.categorize.path, {
        method: api.ai.categorize.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to categorize transaction");
      return api.ai.categorize.responses[200].parse(await res.json());
    },
  });
}
