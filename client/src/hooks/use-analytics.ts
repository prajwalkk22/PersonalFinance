import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useDashboardAnalytics() {
  return useQuery({
    queryKey: [api.analytics.dashboard.path],
    queryFn: async () => {
      const res = await fetch(api.analytics.dashboard.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return api.analytics.dashboard.responses[200].parse(await res.json());
    },
  });
}

export function useTaxAnalytics() {
  return useQuery({
    queryKey: [api.analytics.tax.path],
    queryFn: async () => {
      const res = await fetch(api.analytics.tax.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tax data");
      return api.analytics.tax.responses[200].parse(await res.json());
    },
  });
}
