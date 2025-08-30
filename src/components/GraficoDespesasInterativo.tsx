import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useReferenceMonth } from '@/contexts/ReferenceMonthContext';

interface CategoryData {
  id: number;
  name: string;
  amount: number;
}

interface SubcategoryData {
  name: string;
  amount: number;
}

interface GraficoDespesasInterativoProps {
  loading: boolean;
}

const GraficoDespesasInterativo = ({ loading }: GraficoDespesasInterativoProps) => {
  const { user } = useAuth();
  const { referenceMonth } = useReferenceMonth();
  const [viewMode, setViewMode] = useState<'categories' | 'subcategories'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [subcategoryData, setSubcategoryData] = useState<SubcategoryData[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const chartConfig = {
    amount: {
      label: "Valor",
      color: "hsl(var(--chart-1))",
    },
  };

  const loadCategoriesData = async () => {
    if (!user) return;

    try {
      setDataLoading(true);
      
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          amount,
          categories (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('type', 'Expense')
        .eq('reference_month', referenceMonth)
        .not('categories', 'is', null);

      if (error) {
        console.error('Error fetching category data:', error);
        return;
      }

      // Group by category
      const categoryMap = new Map<number, { name: string, amount: number }>();
      
      transactions?.forEach(t => {
        if (t.categories) {
          const categoryId = t.categories.id;
          const categoryName = t.categories.name;
          const currentData = categoryMap.get(categoryId) || { name: categoryName, amount: 0 };
          categoryMap.set(categoryId, {
            name: categoryName,
            amount: currentData.amount + Number(t.amount)
          });
        }
      });

      const categories = Array.from(categoryMap.entries())
        .map(([id, data]) => ({
          id,
          name: data.name,
          amount: data.amount
        }))
        .sort((a, b) => b.amount - a.amount);

      setCategoryData(categories);
      
    } catch (error) {
      console.error('Error loading categories data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const loadSubcategoriesData = async (categoryId: number) => {
    if (!user) return;

    try {
      setDataLoading(true);
      
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          amount,
          subcategories (
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('type', 'Expense')
        .eq('category_id', categoryId)
        .eq('reference_month', referenceMonth)
        .not('subcategories', 'is', null);

      if (error) {
        console.error('Error fetching subcategory data:', error);
        return;
      }

      // Group by subcategory
      const subcategoryMap = new Map<string, number>();
      
      transactions?.forEach(t => {
        if (t.subcategories) {
          const subcategoryName = t.subcategories.name;
          const currentAmount = subcategoryMap.get(subcategoryName) || 0;
          subcategoryMap.set(subcategoryName, currentAmount + Number(t.amount));
        }
      });

      const subcategories = Array.from(subcategoryMap.entries())
        .map(([name, amount]) => ({
          name,
          amount
        }))
        .sort((a, b) => b.amount - a.amount);

      setSubcategoryData(subcategories);
      
    } catch (error) {
      console.error('Error loading subcategories data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const handleCategoryClick = (data: any) => {
    const category = categoryData.find(cat => cat.name === data.name);
    if (category) {
      setSelectedCategory(category);
      setViewMode('subcategories');
      loadSubcategoriesData(category.id);
    }
  };

  const handleBackToCategories = () => {
    setViewMode('categories');
    setSelectedCategory(null);
    setSubcategoryData([]);
  };

  // Reset to categories view when reference month changes
  useEffect(() => {
    handleBackToCategories();
  }, [referenceMonth]);

  // Load categories data when component mounts or reference month changes
  useEffect(() => {
    if (viewMode === 'categories') {
      loadCategoriesData();
    }
  }, [referenceMonth, user, viewMode]);

  const currentData = viewMode === 'categories' ? categoryData : subcategoryData;
  const isEmpty = currentData.length === 0;
  const isLoading = loading || dataLoading;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center gap-4">
          {viewMode === 'subcategories' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToCategories}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar para Categorias
            </Button>
          )}
          <CardTitle>
            {viewMode === 'categories' 
              ? 'Despesas por Categoria'
              : `Despesas em ${selectedCategory?.name}`
            }
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : isEmpty ? (
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">
              {viewMode === 'categories' 
                ? 'Nenhuma despesa encontrada para o período selecionado'
                : 'Nenhuma subcategoria encontrada para esta categoria'
              }
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentData}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value: any) => [formatCurrency(value), 'Valor']}
                  labelFormatter={(label) => 
                    `${viewMode === 'categories' ? 'Categoria' : 'Subcategoria'}: ${label}`
                  }
                />
                <Bar 
                  dataKey="amount" 
                  fill="var(--color-amount)"
                  radius={[4, 4, 0, 0]}
                  className={viewMode === 'categories' ? 'cursor-pointer hover:opacity-80' : ''}
                  onClick={viewMode === 'categories' ? handleCategoryClick : undefined}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default GraficoDespesasInterativo;