import { useQuery } from "@tanstack/react-query";
import { fetchCategoryInsights, CategoryInsight } from "@/lib/insights";

// Recebe string (yyyy-MM-dd) diretamente para evitar problemas de timezone
export function useCategoryInsights(refMonth: string) {
  return useQuery<CategoryInsight[]>({
    queryKey: ["category-insights", refMonth],
    queryFn: () => fetchCategoryInsights(refMonth),
    staleTime: 1000 * 60 * 5,
  });
}
