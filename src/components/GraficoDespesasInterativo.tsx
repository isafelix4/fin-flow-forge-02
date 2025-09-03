import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface CategoryData {
  id: number;
  name: string;
  amount: number;
  average?: number;
}

interface SubcategoryData {
  name: string;
  amount: number;
}

interface ExpenseData {
  categoryId: number;
  categoryName: string;
  subcategoryId?: number;
  subcategoryName?: string;
  amount: number;
}

interface CategoryAverage {
  [categoryId: number]: {
    name: string;
    average: number;
  };
}

interface GraficoDespesasInterativoProps {
  loading: boolean;
  expenseData: ExpenseData[];
  categoryAverages: CategoryAverage;
}

const GraficoDespesasInterativo = ({ loading, expenseData, categoryAverages }: GraficoDespesasInterativoProps) => {
  const [viewMode, setViewMode] = useState<'categories' | 'subcategories'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [subcategoryData, setSubcategoryData] = useState<SubcategoryData[]>([]);

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

  const calculateVariation = (current: number, average: number) => {
    if (average === 0) return { percentage: 0, isIncrease: false };
    const percentage = ((current - average) / average) * 100;
    return { percentage: Math.abs(percentage), isIncrease: current > average };
  };

  const processExpenseData = () => {
    if (!expenseData) return;

    // Group by category
    const categoryMap = new Map<number, { name: string, amount: number }>();
    
    expenseData.forEach(expense => {
      const currentData = categoryMap.get(expense.categoryId) || { 
        name: expense.categoryName, 
        amount: 0 
      };
      categoryMap.set(expense.categoryId, {
        name: expense.categoryName,
        amount: currentData.amount + expense.amount
      });
    });

    const categories = Array.from(categoryMap.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        amount: data.amount,
        average: categoryAverages[id]?.average || 0
      }))
      .sort((a, b) => b.amount - a.amount);

    setCategoryData(categories);
  };

  const loadSubcategoriesData = (categoryId: number) => {
    if (!expenseData) return;

    // Group by subcategory for the selected category
    const subcategoryMap = new Map<string, number>();
    
    expenseData
      .filter(expense => expense.categoryId === categoryId && expense.subcategoryName)
      .forEach(expense => {
        const subcategoryName = expense.subcategoryName!;
        const currentAmount = subcategoryMap.get(subcategoryName) || 0;
        subcategoryMap.set(subcategoryName, currentAmount + expense.amount);
      });

    const subcategories = Array.from(subcategoryMap.entries())
      .map(([name, amount]) => ({
        name,
        amount
      }))
      .sort((a, b) => b.amount - a.amount);

    setSubcategoryData(subcategories);
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

  // Process expense data when it changes
  useEffect(() => {
    processExpenseData();
  }, [expenseData, categoryAverages]);

  // Reset to categories view when expense data changes
  useEffect(() => {
    handleBackToCategories();
  }, [expenseData]);

  const currentData = viewMode === 'categories' ? categoryData : subcategoryData;
  const isEmpty = currentData.length === 0;
  const isLoading = loading;

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
              : `Despesas em ${selectedCategory?.name} (Total: ${formatCurrency(selectedCategory?.amount || 0)})`
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
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    
                    const data = payload[0].payload;
                    const value = payload[0].value as number;
                    
                    return (
                      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                        <p className="font-medium">{`${viewMode === 'categories' ? 'Categoria' : 'Subcategoria'}: ${label}`}</p>
                        <p className="text-primary">Valor do Mês: {formatCurrency(value)}</p>
                        {viewMode === 'categories' && data.average > 0 && (
                          <>
                            <p className="text-muted-foreground">Média (3m): {formatCurrency(data.average)}</p>
                            <p className={`text-sm ${
                              value > data.average ? 'text-red-500' : 'text-green-500'
                            }`}>
                              Variação: {(() => {
                                const variation = calculateVariation(value, data.average);
                                return `${variation.isIncrease ? '+' : '-'}${variation.percentage.toFixed(0)}%`;
                              })()}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar 
                  dataKey="amount" 
                  fill="var(--color-amount)"
                  radius={[4, 4, 0, 0]}
                  className={viewMode === 'categories' ? 'cursor-pointer hover:opacity-80' : ''}
                  onClick={viewMode === 'categories' ? handleCategoryClick : undefined}
                />
                {/* Add a secondary bar to show averages when in categories view */}
                {viewMode === 'categories' && (
                  <Bar 
                    dataKey="average" 
                    fill="hsl(var(--muted-foreground))"
                    fillOpacity={0.3}
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default GraficoDespesasInterativo;