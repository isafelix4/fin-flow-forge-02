import { supabase } from "@/integrations/supabase/client";

export type CategoryInsight = {
  category_id: number;
  category_name: string | null;
  current_expense: number;
  income_in_month: number;
  prev3_avg_expense: number;
  deviation_pct: number | null;
  share_over_income: number | null;
  severity: "critico" | "alto" | "medio" | null;
};

export async function fetchCategoryInsights(refMonth: Date) {
  const isoMonth = new Date(refMonth.getFullYear(), refMonth.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .rpc("get_category_insights", { ref_month: isoMonth });

  if (error) throw error;
  return (data ?? []) as CategoryInsight[];
}
