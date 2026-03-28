import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface CategoryData {
  id: number;
  name: string;
  amount: number;
  type: 'Standard' | 'Debt' | 'Investment';
}

interface SubcategoryData {
  name: string;
  amount: number;
}

interface ExpenseData {
  categoryId: number;
  categoryName: string;
  categoryType: 'Standard' | 'Debt' | 'Investment';
  subcategoryId?: number;
  subcategoryName?: string;
  amount: number;
}

interface GraficoDespesasInterativoProps {
  loading: boolean;
  expenseData: ExpenseData[];
  previousMonthExpenseData: ExpenseData[];
}

const GraficoDespesasInterativo = ({ loading, expenseData, previousMonthExpenseData }: GraficoDespesasInterativoProps) => {
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

  const STANDARD_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#4338ca', '#be185d', '#c2410c', '#0e7490', '#6366f1'];
  const DEBT_COLOR = '#dc2626';
  const INVESTMENT_COLOR = '#16a34a';

  // Lookup maps for previous month data
  const previousByCategoryMap = useMemo(() => {
    const map = new Map<number, number>();
    previousMonthExpenseData.forEach(e => {
      map.set(e.categoryId, (map.get(e.categoryId) || 0) + e.amount);
    });
    return map;
  }, [previousMonthExpenseData]);

  const previousBySubcategoryMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedCategory) return map;
    previousMonthExpenseData
      .filter(e => e.categoryId === selectedCategory.id && e.subcategoryName)
      .forEach(e => {
        map.set(e.subcategoryName!, (map.get(e.subcategoryName!) || 0) + e.amount);
      });
    return map;
  }, [previousMonthExpenseData, selectedCategory]);

  const processExpenseData = () => {
    if (!expenseData) return;

    const categoryMap = new Map<number, { name: string, amount: number, type: 'Standard' | 'Debt' | 'Investment' }>();
    
    expenseData.forEach(expense => {
      const currentData = categoryMap.get(expense.categoryId) || { 
        name: expense.categoryName, 
        amount: 0,
        type: expense.categoryType
      };
      categoryMap.set(expense.categoryId, {
        name: expense.categoryName,
        amount: currentData.amount + expense.amount,
        type: expense.categoryType
      });
    });

    const categories = Array.from(categoryMap.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        amount: data.amount,
        type: data.type,
      }))
      .sort((a, b) => b.amount - a.amount);

    setCategoryData(categories);
  };

  const loadSubcategoriesData = (categoryId: number) => {
    if (!expenseData) return;

    const subcategoryMap = new Map<string, number>();
    
    expenseData
      .filter(expense => expense.categoryId === categoryId && expense.subcategoryName)
      .forEach(expense => {
        const subcategoryName = expense.subcategoryName!;
        const currentAmount = subcategoryMap.get(subcategoryName) || 0;
        subcategoryMap.set(subcategoryName, currentAmount + expense.amount);
      });

    const subcategories = Array.from(subcategoryMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    setSubcategoryData(subcategories);
  };

  const getCategoryColor = (categoryId: number, categoryType?: 'Standard' | 'Debt' | 'Investment') => {
    if (categoryType === 'Debt') return DEBT_COLOR;
    if (categoryType === 'Investment') return INVESTMENT_COLOR;
    return STANDARD_COLORS[categoryId % STANDARD_COLORS.length];
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

  useEffect(() => {
    processExpenseData();
  }, [expenseData]);

  useEffect(() => {
    handleBackToCategories();
  }, [expenseData]);

  const renderPreviousMonth = (previous: number | undefined) => {
    if (previous === undefined || previous === 0) {
      return (
        <p className="text-xs text-muted-foreground">Mês anterior: Sem dados</p>
      );
    }
    return (
      <p className="text-xs text-muted-foreground">
        Mês anterior: {formatCurrency(previous)}
      </p>
    );
  };

  const currentData = viewMode === 'categories' ? categoryData : subcategoryData;
  const isEmpty = currentData.length === 0;
  const isLoading = loading;

  return (
    <Card className="w-full">
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
          <ChartContainer config={chartConfig} className="min-h-[400px] h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <ChartTooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const value = payload[0].value as number;

                      let previousValue: number | undefined;
                      if (viewMode === 'categories') {
                        previousValue = previousByCategoryMap.get(data.id);
                      } else {
                        previousValue = previousBySubcategoryMap.get(data.name);
                      }

                      const percentage = previousValue && previousValue > 0
                        ? ((value - previousValue) / previousValue) * 100
                        : undefined;
                      const sign = percentage !== undefined && percentage > 0 ? '+' : '';
                      const variationColor = percentage !== undefined
                        ? (percentage > 0 ? 'text-destructive' : 'text-green-600')
                        : '';

                      return (
                        <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-sm">
                          <p className="font-bold mb-1">{label}</p>
                          <p className="text-primary">
                            Mês atual: {formatCurrency(value)}
                            {percentage !== undefined && (
                              <span className={`ml-1 ${variationColor}`}>
                                ({sign}{percentage.toFixed(1)}%)
                              </span>
                            )}
                          </p>
                          {renderVariation(value, previousValue)}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="amount" 
                  fill="var(--color-amount)"
                  radius={[4, 4, 0, 0]}
                  className={viewMode === 'categories' ? 'cursor-pointer hover:opacity-80' : ''}
                  onClick={viewMode === 'categories' ? handleCategoryClick : undefined}
                >
                  {viewMode === 'categories' && categoryData.map((entry) => (
                    <Cell key={`cell-${entry.id}`} fill={getCategoryColor(entry.id, entry.type)} />
                  ))}
                  {viewMode === 'subcategories' && subcategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={selectedCategory ? getCategoryColor(selectedCategory.id, selectedCategory.type) : STANDARD_COLORS[0]} />
                  ))}
                  <LabelList 
                    dataKey="amount" 
                    position="top" 
                    fill="hsl(var(--foreground))"
                    formatter={(value: number) => formatCurrency(value)}
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default GraficoDespesasInterativo;
