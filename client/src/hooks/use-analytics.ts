import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

/* ================= DASHBOARD ANALYTICS ================= */

export function useDashboardAnalytics() {
  return useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: async () => {
      const res = await fetch(api.analytics.dashboard.path, {
        method: api.analytics.dashboard.method,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch dashboard analytics");
      }

      const json = await res.json();
      return api.analytics.dashboard.responses[200].parse(json);
    },
  });
}

/* ================= TAX ANALYTICS ================= */

export function useTaxAnalytics() {
  return useQuery({
    queryKey: ["analytics", "tax"],
    queryFn: async () => {
      const res = await fetch(api.analytics.tax.path, {
        method: api.analytics.tax.method,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch tax analytics");
      }

      const json = await res.json();
      return api.analytics.tax.responses[200].parse(json);
    },
  });
}
