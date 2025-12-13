import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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

// Mapeamento de prioridade para ordenação (menor = mais crítico)
const severityOrder: Record<string, number> = {
  critico: 1,
  alto: 2,
  medio: 3,
};

export async function fetchCategoryInsights(refMonth: Date): Promise<CategoryInsight[]> {
  // Formata a data como string yyyy-MM-dd para evitar problemas de timezone
  // Usa os valores locais do Date (getFullYear, getMonth) para garantir o mês correto
  const year = refMonth.getFullYear();
  const month = refMonth.getMonth(); // 0-indexed
  const refMonthStr = format(new Date(year, month, 1), "yyyy-MM-dd");

  const { data, error } = await supabase
    .rpc("get_category_insights", { ref_month: refMonthStr });

  if (error) throw error;

  const insights = (data ?? []) as CategoryInsight[];

  // Ordena por severidade (crítico > alto > médio) e depois por valor absoluto
  return insights
    .filter((i) => i.severity !== null)
    .sort((a, b) => {
      const severityA = a.severity ? severityOrder[a.severity] : 999;
      const severityB = b.severity ? severityOrder[b.severity] : 999;
      
      // Primeiro por severidade
      if (severityA !== severityB) {
        return severityA - severityB;
      }
      
      // Depois por valor de despesa (maior primeiro)
      return (b.current_expense ?? 0) - (a.current_expense ?? 0);
    });
}
