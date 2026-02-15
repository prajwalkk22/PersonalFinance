import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { QUERY_KEYS } from "@/lib/queryKeys";

/* ================= DASHBOARD ANALYTICS ================= */

export function useDashboardAnalytics() {
  return useQuery({
    queryKey: QUERY_KEYS.DASHBOARD,
    queryFn: async () => {
      const res = await fetch(api.analytics.dashboard.path, {
        method: api.analytics.dashboard.method,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch dashboard analytics");
      }

      return api.analytics.dashboard.responses[200].parse(
        await res.json()
      );
    },
  });
}

/* ================= TAX ANALYTICS ================= */

export function useTaxAnalytics() {
  return useQuery({
    queryKey: QUERY_KEYS.TAX,
    queryFn: async () => {
      const res = await fetch(api.analytics.tax.path, {
        method: api.analytics.tax.method,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch tax analytics");
      }

      return api.analytics.tax.responses[200].parse(
        await res.json()
      );
    },
  });
}
