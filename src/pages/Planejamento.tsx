import React, { useState, useEffect, useCallback } from 'react';
import { useReferenceMonth } from '@/contexts/ReferenceMonthContext';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Category {
  id: number;
  name: string;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: number;
  name: string;
  category_id: number;
}

interface Budget {
  id: number;
  category_id: number;
  subcategory_id: number | null;
  planned_amount: number;
  plan_type: 'RECEITA' | 'DESPESA';
}

interface TransactionSummary {
  category_id: number;
  subcategory_id: number | null;
  total_amount: number;
  transaction_type: 'Income' | 'Expense';
}

interface PlanningData {
  category_id: number;
  subcategory_id: number | null;
  planned_amount: number;
  realized_amount: number;
}

const Planejamento = () => {
  const { referenceMonth, setReferenceMonth } = useReferenceMonth();
  const { user } = useAuth();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactionSummaries, setTransactionSummaries] = useState<TransactionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTimeouts, setSavingTimeouts] = useState<{ [key: string]: NodeJS.Timeout }>({});

  // Summary calculations
  const receitasPlanejadas = budgets
    .filter(b => b.plan_type === 'RECEITA')
    .reduce((sum, b) => sum + Number(b.planned_amount), 0);

  const receitasRealizadas = transactionSummaries
    .filter(t => t.transaction_type === 'Income')
    .reduce((sum, t) => sum + Number(t.total_amount), 0);

  const despesasPlanejadas = budgets
    .filter(b => b.plan_type === 'DESPESA')
    .reduce((sum, b) => sum + Number(b.planned_amount), 0);

  const despesasRealizadas = transactionSummaries
    .filter(t => t.transaction_type === 'Expense')
    .reduce((sum, t) => sum + Number(t.total_amount), 0);

  const saldoPrevisto = receitasPlanejadas - despesasPlanejadas;
  const saldoAtual = receitasRealizadas - despesasRealizadas;

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load categories with subcategories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select(`
          id,
          name,
          subcategories (
            id,
            name,
            category_id
          )
        `)
        .eq('user_id', user.id)
        .order('name');

      if (categoriesError) throw categoriesError;

      // Load budgets for the reference month
      const { data: budgetsData, error: budgetsError } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('reference_month', referenceMonth);

      if (budgetsError) throw budgetsError;

      // Load transaction summaries for the reference month
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('category_id, subcategory_id, amount, type')
        .eq('user_id', user.id)
        .eq('reference_month', referenceMonth);

      if (transactionsError) throw transactionsError;

      // Group transactions by category and subcategory
      const summaries: TransactionSummary[] = [];
      transactionsData?.forEach(transaction => {
        const existing = summaries.find(s => 
          s.category_id === transaction.category_id && 
          s.subcategory_id === transaction.subcategory_id &&
          s.transaction_type === transaction.type
        );

        if (existing) {
          existing.total_amount += Number(transaction.amount);
        } else {
          summaries.push({
            category_id: transaction.category_id,
            subcategory_id: transaction.subcategory_id,
            total_amount: Number(transaction.amount),
            transaction_type: transaction.type
          });
        }
      });

      setCategories(categoriesData || []);
      setBudgets((budgetsData || []).map(budget => ({
        ...budget,
        plan_type: budget.plan_type as 'RECEITA' | 'DESPESA'
      })));
      setTransactionSummaries(summaries);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados de planejamento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, referenceMonth, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveBudget = useCallback(async (
    planType: 'RECEITA' | 'DESPESA',
    plannedAmount: number,
    categoryId: number,
    subcategoryId: number | null = null
  ) => {
    if (!user) return;

    try {
      const budgetData = {
        user_id: user.id,
        reference_month: referenceMonth,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        planned_amount: plannedAmount,
        plan_type: planType
      };

      const { data, error } = await supabase
        .from('budgets')
        .upsert(budgetData, {
          onConflict: 'user_id,reference_month,category_id,subcategory_id,plan_type'
        })
        .select();

      if (error) throw error;

      // Update local state
      setBudgets(prev => {
        const existingIndex = prev.findIndex(b => 
          b.category_id === categoryId && 
          b.subcategory_id === subcategoryId &&
          b.plan_type === planType
        );

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], planned_amount: plannedAmount };
          return updated;
        } else {
          return [...prev, { ...budgetData, id: data[0].id }];
        }
      });
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o planejamento.",
        variant: "destructive",
      });
    }
  }, [user, referenceMonth, toast]);

  const debouncedSave = useCallback((
    planType: 'RECEITA' | 'DESPESA',
    value: number,
    categoryId: number,
    subcategoryId: number | null = null
  ) => {
    const key = `${planType}-${categoryId}-${subcategoryId}`;
    
    if (savingTimeouts[key]) {
      clearTimeout(savingTimeouts[key]);
    }

    const timeout = setTimeout(() => {
      saveBudget(planType, value, categoryId, subcategoryId);
      setSavingTimeouts(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    }, 500);

    setSavingTimeouts(prev => ({ ...prev, [key]: timeout }));
  }, [saveBudget, savingTimeouts]);

  const getBudgetValue = (planType: 'RECEITA' | 'DESPESA', categoryId: number, subcategoryId: number | null = null) => {
    const budget = budgets.find(b => 
      b.plan_type === planType && 
      b.category_id === categoryId && 
      b.subcategory_id === subcategoryId
    );
    return budget ? Number(budget.planned_amount) : 0;
  };

  const getRealizedValue = (transactionType: 'Income' | 'Expense', categoryId: number, subcategoryId: number | null = null) => {
    const summary = transactionSummaries.find(t => 
      t.transaction_type === transactionType && 
      t.category_id === categoryId && 
      t.subcategory_id === subcategoryId
    );
    return summary ? Number(summary.total_amount) : 0;
  };

  const getCategoryTotals = (category: Category, planType: 'RECEITA' | 'DESPESA') => {
    const transactionType = planType === 'RECEITA' ? 'Income' : 'Expense';
    
    let plannedTotal = getBudgetValue(planType, category.id);
    let realizedTotal = getRealizedValue(transactionType, category.id);

    // Add subcategory totals
    category.subcategories?.forEach(sub => {
      plannedTotal += getBudgetValue(planType, category.id, sub.id);
      realizedTotal += getRealizedValue(transactionType, category.id, sub.id);
    });

    return { plannedTotal, realizedTotal };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage <= 80) return 'bg-primary';
    if (percentage <= 100) return 'bg-yellow-500';
    return 'bg-destructive';
  };

  const renderPlanningTable = (category: Category, planType: 'RECEITA' | 'DESPESA') => {
    const transactionType = planType === 'RECEITA' ? 'Income' : 'Expense';
    
    return (
      <div className="space-y-2">
        {/* Main category row */}
        <div className="grid grid-cols-5 gap-4 items-center p-2 border rounded">
          <div className="font-medium">{category.name}</div>
          <div>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={getBudgetValue(planType, category.id) || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                debouncedSave(planType, value, category.id);
              }}
              className="h-8"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {formatCurrency(getRealizedValue(transactionType, category.id))}
          </div>
          <div className="text-sm">
            {formatCurrency(getBudgetValue(planType, category.id) - getRealizedValue(transactionType, category.id))}
          </div>
          <div className="w-full">
            {getBudgetValue(planType, category.id) > 0 && (
              <Progress
                value={Math.min((getRealizedValue(transactionType, category.id) / getBudgetValue(planType, category.id)) * 100, 100)}
                className="h-2"
              />
            )}
          </div>
        </div>

        {/* Subcategory rows */}
        {category.subcategories?.map(subcategory => (
          <div key={subcategory.id} className="grid grid-cols-5 gap-4 items-center p-2 border rounded ml-4">
            <div className="text-sm text-muted-foreground">→ {subcategory.name}</div>
            <div>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={getBudgetValue(planType, category.id, subcategory.id) || ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  debouncedSave(planType, value, category.id, subcategory.id);
                }}
                className="h-8"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(getRealizedValue(transactionType, category.id, subcategory.id))}
            </div>
            <div className="text-sm">
              {formatCurrency(getBudgetValue(planType, category.id, subcategory.id) - getRealizedValue(transactionType, category.id, subcategory.id))}
            </div>
            <div className="w-full">
              {getBudgetValue(planType, category.id, subcategory.id) > 0 && (
                <Progress
                  value={Math.min((getRealizedValue(transactionType, category.id, subcategory.id) / getBudgetValue(planType, category.id, subcategory.id)) * 100, 100)}
                  className="h-2"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Page Title and Period Selector */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Planejamento Mensal</h1>
              <p className="text-muted-foreground mt-1">
                Gerencie suas receitas e despesas planejadas para{' '}
                {format(new Date(referenceMonth), 'MMMM yyyy', { locale: ptBR })}
              </p>
            </div>
            <MonthYearPicker
              value={referenceMonth}
              onValueChange={setReferenceMonth}
              placeholder="Selecionar período"
            />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Receitas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Planejado:</span>
                  <span className="font-medium text-green-600">{formatCurrency(receitasPlanejadas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Realizado:</span>
                  <span className="font-medium">{formatCurrency(receitasRealizadas)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Despesas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Planejado:</span>
                  <span className="font-medium text-red-600">{formatCurrency(despesasPlanejadas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Gasto:</span>
                  <span className="font-medium">{formatCurrency(despesasRealizadas)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Saldo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Previsto:</span>
                  <span className={`font-medium ${saldoPrevisto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(saldoPrevisto)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Atual:</span>
                  <span className={`font-medium ${saldoAtual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(saldoAtual)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Planning Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Receitas Planejadas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl text-green-600">Receitas Planejadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4 mb-4 text-sm font-medium text-muted-foreground">
                  <div>Categoria</div>
                  <div>Planejado</div>
                  <div>Realizado</div>
                  <div>Restante</div>
                  <div>Progresso</div>
                </div>
                
                <Accordion type="multiple" className="space-y-2">
                  {categories.map(category => {
                    const { plannedTotal, realizedTotal } = getCategoryTotals(category, 'RECEITA');
                    
                    return (
                      <AccordionItem key={category.id} value={`receita-${category.id}`}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex justify-between items-center w-full mr-4">
                            <span>{category.name}</span>
                            <div className="flex gap-4 text-sm">
                              <span className="text-green-600">{formatCurrency(plannedTotal)}</span>
                              <span className="text-muted-foreground">{formatCurrency(realizedTotal)}</span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4">
                          {renderPlanningTable(category, 'RECEITA')}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>

            {/* Despesas Planejadas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl text-red-600">Despesas Planejadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4 mb-4 text-sm font-medium text-muted-foreground">
                  <div>Categoria</div>
                  <div>Planejado</div>
                  <div>Gasto</div>
                  <div>Restante</div>
                  <div>Progresso</div>
                </div>
                
                <Accordion type="multiple" className="space-y-2">
                  {categories.map(category => {
                    const { plannedTotal, realizedTotal } = getCategoryTotals(category, 'DESPESA');
                    
                    return (
                      <AccordionItem key={category.id} value={`despesa-${category.id}`}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex justify-between items-center w-full mr-4">
                            <span>{category.name}</span>
                            <div className="flex gap-4 text-sm">
                              <span className="text-red-600">{formatCurrency(plannedTotal)}</span>
                              <span className="text-muted-foreground">{formatCurrency(realizedTotal)}</span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4">
                          {renderPlanningTable(category, 'DESPESA')}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Planejamento;