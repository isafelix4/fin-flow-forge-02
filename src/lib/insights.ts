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

// Mapeamento de prioridade para ordenação (menor = mais crítico)
const severityOrder: Record<string, number> = {
  critico: 1,
  alto: 2,
  medio: 3,
};

// Recebe string (yyyy-MM-dd) diretamente para evitar problemas de timezone
export async function fetchCategoryInsights(refMonthStr: string): Promise<CategoryInsight[]> {
  // Garante formato yyyy-MM-01 para o primeiro dia do mês
  const refMonthFormatted = refMonthStr.substring(0, 7) + "-01";
  
  console.log("Buscando insights para mês de referência:", refMonthFormatted);

  const { data, error } = await supabase
    .rpc("get_category_insights", { ref_month: refMonthFormatted });

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
