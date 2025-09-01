import React, { useState, useEffect, useCallback } from 'react';
import { useReferenceMonth } from '@/contexts/ReferenceMonthContext';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Trash2 } from 'lucide-react';
import { ImprovedAddBudgetModal } from '@/components/ImprovedAddBudgetModal';

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
  category_name?: string;
  subcategory_name?: string;
}

interface TransactionSummary {
  category_id: number;
  subcategory_id: number | null;
  total_amount: number;
  transaction_type: 'Income' | 'Expense';
}

interface BudgetItem {
  category_id: number;
  subcategory_id: number | null;
  category_name: string;
  subcategory_name?: string;
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalPlanType, setModalPlanType] = useState<'RECEITA' | 'DESPESA'>('RECEITA');

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

      // Load budgets for the reference month with category names
      const { data: budgetsData, error: budgetsError } = await supabase
        .from('budgets')
        .select(`
          *,
          categories!inner (
            name
          ),
          subcategories (
            name
          )
        `)
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
        plan_type: budget.plan_type as 'RECEITA' | 'DESPESA',
        category_name: (budget as any).categories?.name,
        subcategory_name: (budget as any).subcategories?.name
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

  const addBudgetItem = useCallback(async (item: BudgetItem) => {
    if (!user) return;

    try {
      const budgetData = {
        user_id: user.id,
        reference_month: referenceMonth,
        category_id: item.category_id,
        subcategory_id: item.subcategory_id,
        planned_amount: 0,
        plan_type: modalPlanType
      };

      const { data, error } = await supabase
        .from('budgets')
        .insert(budgetData)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setBudgets(prev => [...prev, {
        ...budgetData,
        id: data.id,
        category_name: item.category_name,
        subcategory_name: item.subcategory_name
      }]);

      toast({
        title: "Sucesso",
        description: "Item adicionado ao planejamento.",
      });
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o item ao planejamento.",
        variant: "destructive",
      });
    }
  }, [user, referenceMonth, modalPlanType, toast]);

  const removeBudgetItem = useCallback(async (budgetId: number) => {
    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budgetId);

      if (error) throw error;

      // Update local state
      setBudgets(prev => prev.filter(b => b.id !== budgetId));

      toast({
        title: "Sucesso",
        description: "Item removido do planejamento.",
      });
    } catch (error) {
      console.error('Erro ao remover item:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o item.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const updatePlannedAmount = useCallback(async (budgetId: number, newAmount: number) => {
    try {
      const { error } = await supabase
        .from('budgets')
        .update({ planned_amount: newAmount })
        .eq('id', budgetId);

      if (error) throw error;

      // Update local state
      setBudgets(prev => prev.map(b => 
        b.id === budgetId ? { ...b, planned_amount: newAmount } : b
      ));
    } catch (error) {
      console.error('Erro ao atualizar valor planejado:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o planejamento.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const debouncedSave = useCallback((budgetId: number, value: number) => {
    const key = `budget-${budgetId}`;
    
    if (savingTimeouts[key]) {
      clearTimeout(savingTimeouts[key]);
    }

    const timeout = setTimeout(() => {
      updatePlannedAmount(budgetId, value);
      setSavingTimeouts(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    }, 500);

    setSavingTimeouts(prev => ({ ...prev, [key]: timeout }));
  }, [updatePlannedAmount, savingTimeouts]);

  const getRealizedValue = (transactionType: 'Income' | 'Expense', categoryId: number, subcategoryId: number | null = null) => {
    const summary = transactionSummaries.find(t => 
      t.transaction_type === transactionType && 
      t.category_id === categoryId && 
      t.subcategory_id === subcategoryId
    );
    return summary ? Number(summary.total_amount) : 0;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const groupBudgetsByCategory = (planType: 'RECEITA' | 'DESPESA') => {
    const filtered = budgets.filter(b => b.plan_type === planType);
    const grouped: { [categoryId: number]: Budget[] } = {};

    filtered.forEach(budget => {
      if (!grouped[budget.category_id]) {
        grouped[budget.category_id] = [];
      }
      grouped[budget.category_id].push(budget);
    });

    return grouped;
  };

  const renderBudgetRows = (planType: 'RECEITA' | 'DESPESA') => {
    const transactionType = planType === 'RECEITA' ? 'Income' : 'Expense';
    const filteredBudgets = budgets.filter(b => b.plan_type === planType);

    if (filteredBudgets.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
            <p>Nenhum item adicionado ao planejamento.</p>
            <p className="text-sm">Clique em "+ Adicionar Orçamento" para começar.</p>
          </TableCell>
        </TableRow>
      );
    }

    return filteredBudgets.map(budget => {
      const realizedValue = getRealizedValue(transactionType, budget.category_id, budget.subcategory_id);
      const remainingValue = Number(budget.planned_amount) - realizedValue;
      const progressPercentage = budget.planned_amount > 0 
        ? Math.min((realizedValue / Number(budget.planned_amount)) * 100, 100) 
        : 0;

      return (
        <TableRow key={budget.id}>
          <TableCell className="font-medium">
            {budget.category_name || 'Categoria Desconhecida'}
          </TableCell>
          <TableCell>
            {budget.subcategory_name || '-'}
          </TableCell>
          <TableCell>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={budget.planned_amount || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                debouncedSave(budget.id, value);
              }}
              className="h-8 w-24"
            />
          </TableCell>
          <TableCell className="text-muted-foreground">
            {formatCurrency(realizedValue)}
          </TableCell>
          <TableCell className={remainingValue >= 0 ? 'text-muted-foreground' : 'text-red-600'}>
            {formatCurrency(remainingValue)}
          </TableCell>
          <TableCell>
            <div className="w-full max-w-[100px]">
              {budget.planned_amount > 0 && (
                <Progress
                  value={progressPercentage}
                  className="h-2"
                />
              )}
            </div>
          </TableCell>
          <TableCell>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeBudgetItem(budget.id)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      );
    });
  };

  const handleAddBudget = (planType: 'RECEITA' | 'DESPESA') => {
    setModalPlanType(planType);
    setShowAddModal(true);
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
                {format(new Date(referenceMonth + 'T12:00:00'), 'MMMM yyyy', { locale: ptBR })}
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
                  <span className="font-medium text-emerald-600">{formatCurrency(receitasPlanejadas)}</span>
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
                  <span className={`font-medium ${saldoPrevisto >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(saldoPrevisto)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Atual:</span>
                  <span className={`font-medium ${saldoAtual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
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
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl text-emerald-600">Receitas Planejadas</CardTitle>
                  <Button
                    onClick={() => handleAddBudget('RECEITA')}
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar Orçamento
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Subcategoria</TableHead>
                        <TableHead>Planejado</TableHead>
                        <TableHead>Realizado</TableHead>
                        <TableHead>Restante</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {renderBudgetRows('RECEITA')}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Despesas Planejadas */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl text-red-600">Despesas Planejadas</CardTitle>
                  <Button
                    onClick={() => handleAddBudget('DESPESA')}
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar Orçamento
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Subcategoria</TableHead>
                        <TableHead>Planejado</TableHead>
                        <TableHead>Gasto</TableHead>
                        <TableHead>Restante</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {renderBudgetRows('DESPESA')}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ImprovedAddBudgetModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        planType={modalPlanType}
        onAddItem={addBudgetItem}
        existingBudgets={budgets}
      />
    </div>
  );
};

export default Planejamento;