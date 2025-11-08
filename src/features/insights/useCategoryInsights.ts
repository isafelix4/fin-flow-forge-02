import { useQuery } from "@tanstack/react-query";
import { fetchCategoryInsights, CategoryInsight } from "@/lib/insights";

export function useCategoryInsights(refMonth: Date) {
  return useQuery<CategoryInsight[]>({
    queryKey: ["category-insights", refMonth.getFullYear(), refMonth.getMonth()],
    queryFn: () => fetchCategoryInsights(refMonth),
    staleTime: 1000 * 60 * 5,
  });
}
