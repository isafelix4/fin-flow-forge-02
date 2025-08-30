import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useReferenceMonth } from '@/contexts/ReferenceMonthContext';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { PlanejamentoModal } from '@/components/PlanejamentoModal';

interface PlanejamentoData {
  receitaPlanejada: number;
  receitaRealizada: number;
  totalPlanejado: number;
  totalGasto: number;
  saldoPrevisto: number;
  saldoAtual: number;
}

interface PlanejamentoItem {
  id: number;
  category_id: number;
  subcategory_id: number | null;
  planned_amount: number;
  plan_type: 'RECEITA' | 'DESPESA';
  category_name: string;
  subcategory_name?: string;
  realizado: number;
}

interface AggregatedPlanejamento {
  category_id: number;
  category_name: string;
  planned_amount: number;
  realizado: number;
  items: PlanejamentoItem[];
}

const Planejamento = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { referenceMonth, setReferenceMonth } = useReferenceMonth();
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'RECEITA' | 'DESPESA'>('RECEITA');
  const [editingItem, setEditingItem] = useState<PlanejamentoItem | null>(null);
  
  const [planejamentoData, setPlanejamentoData] = useState<PlanejamentoData>({
    receitaPlanejada: 0,
    receitaRealizada: 0,
    totalPlanejado: 0,
    totalGasto: 0,
    saldoPrevisto: 0,
    saldoAtual: 0,
  });

  const [planejamentosReceita, setPlanejamentosReceita] = useState<AggregatedPlanejamento[]>([]);
  const [planejamentosDespesa, setPlanejamentosDespesa] = useState<AggregatedPlanejamento[]>([]);

  const loadPlanejamentoData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);

      // Get budgets for the selected month
      const { data: budgets, error: budgetsError } = await supabase
        .from('budgets')
        .select(`
          *,
          categories (
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('reference_month', referenceMonth);

      if (budgetsError) {
        console.error('Error fetching budgets:', budgetsError);
        toast({
          title: "Erro ao carregar planejamentos",
          description: "Não foi possível carregar os dados do planejamento.",
          variant: "destructive"
        });
        return;
      }

      // Get transactions for the selected month
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          amount,
          type,
          category_id,
          subcategory_id
        `)
        .eq('user_id', user.id)
        .eq('reference_month', referenceMonth);

      if (transactionsError) {
        console.error('Error fetching transactions:', transactionsError);
        return;
      }

      // Get all subcategories for the user to resolve names later
      const { data: allSubcategories } = await supabase
        .from('subcategories')
        .select('id, name')
        .eq('user_id', user.id);

      const subcategoryMap = new Map(allSubcategories?.map(s => [s.id, s.name]) || []);

      // Process budgets
      const receitas = budgets?.filter(b => b.plan_type === 'RECEITA') || [];
      const despesas = budgets?.filter(b => b.plan_type === 'DESPESA') || [];

      // Calculate realized amounts for each budget item
      const processedReceitas = receitas.map(budget => {
        const realizado = transactions
          ?.filter(t => 
            t.type === 'Income' && 
            t.category_id === budget.category_id &&
            (budget.subcategory_id === null || t.subcategory_id === budget.subcategory_id)
          )
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        return {
          id: budget.id,
          category_id: budget.category_id,
          subcategory_id: budget.subcategory_id,
          planned_amount: Number(budget.planned_amount),
          plan_type: budget.plan_type as 'RECEITA' | 'DESPESA',
          category_name: budget.categories?.name || '',
          subcategory_name: budget.subcategory_id ? subcategoryMap.get(budget.subcategory_id) : undefined,
          realizado
        };
      });

      const processedDespesas = despesas.map(budget => {
        const realizado = transactions
          ?.filter(t => 
            t.type === 'Expense' && 
            t.category_id === budget.category_id &&
            (budget.subcategory_id === null || t.subcategory_id === budget.subcategory_id)
          )
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        return {
          id: budget.id,
          category_id: budget.category_id,
          subcategory_id: budget.subcategory_id,
          planned_amount: Number(budget.planned_amount),
          plan_type: budget.plan_type as 'RECEITA' | 'DESPESA',
          category_name: budget.categories?.name || '',
          subcategory_name: budget.subcategory_id ? subcategoryMap.get(budget.subcategory_id) : undefined,
          realizado
        };
      });

      // Aggregate by category for display
      const aggregateReceitas = aggregateByCategory(processedReceitas, transactions || [], 'Income');
      const aggregateDespesas = aggregateByCategory(processedDespesas, transactions || [], 'Expense');

      setPlanejamentosReceita(aggregateReceitas);
      setPlanejamentosDespesa(aggregateDespesas);

      // Calculate summary data
      const receitaPlanejada = processedReceitas.reduce((sum, item) => sum + item.planned_amount, 0);
      const receitaRealizada = transactions
        ?.filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const totalPlanejado = processedDespesas.reduce((sum, item) => sum + item.planned_amount, 0);
      const totalGasto = transactions
        ?.filter(t => t.type === 'Expense')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      setPlanejamentoData({
        receitaPlanejada,
        receitaRealizada,
        totalPlanejado,
        totalGasto,
        saldoPrevisto: receitaPlanejada - totalPlanejado,
        saldoAtual: receitaRealizada - totalGasto,
      });

    } catch (error) {
      console.error('Error loading planejamento data:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao carregar os dados.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlanejamentoData();
  }, [referenceMonth, user]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value / 100);
  };

  const handleAddPlanejamento = (type: 'RECEITA' | 'DESPESA') => {
    setModalType(type);
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const aggregateByCategory = (items: PlanejamentoItem[], transactions: any[], transactionType: 'Income' | 'Expense'): AggregatedPlanejamento[] => {
    const categoryMap = new Map<number, AggregatedPlanejamento>();

    items.forEach(item => {
      const existing = categoryMap.get(item.category_id);
      if (existing) {
        existing.planned_amount += item.planned_amount;
        existing.realizado += item.realizado;
        existing.items.push(item);
      } else {
        categoryMap.set(item.category_id, {
          category_id: item.category_id,
          category_name: item.category_name,
          planned_amount: item.planned_amount,
          realizado: item.realizado,
          items: [item]
        });
      }
    });

    // Calculate total realized amount per category including transactions without budget items
    transactions.filter(t => t.type === transactionType).forEach(transaction => {
      const existing = categoryMap.get(transaction.category_id);
      if (existing) {
        // Already calculated above from individual items
        return;
      } else {
        // This category has transactions but no budget planning
        const categoryRealizado = transactions
          .filter(t => t.type === transactionType && t.category_id === transaction.category_id)
          .reduce((sum, t) => sum + Number(t.amount), 0);
        
        if (categoryRealizado > 0) {
          categoryMap.set(transaction.category_id, {
            category_id: transaction.category_id,
            category_name: `Categoria ${transaction.category_id}`, // Will need to get real name
            planned_amount: 0,
            realizado: categoryRealizado,
            items: []
          });
        }
      }
    });

    return Array.from(categoryMap.values());
  };

  const handleEditPlanejamento = (item: PlanejamentoItem) => {
    setEditingItem(item);
    setModalType(item.plan_type);
    setIsModalOpen(true);
  };

  const handleDeletePlanejamento = async (id: number) => {
    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Planejamento excluído",
        description: "O planejamento foi excluído com sucesso.",
      });

      loadPlanejamentoData();
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir o planejamento.",
        variant: "destructive"
      });
    }
  };

  const onPlanejamentoSaved = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    loadPlanejamentoData();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Planejamento Mensal</h1>
          <p className="text-muted-foreground">
            Defina e acompanhe suas metas financeiras mensais
          </p>
        </div>

        {/* Month Filter */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <label htmlFor="month-filter" className="text-sm font-medium">
            Período de referência:
          </label>
          <MonthYearPicker
            value={referenceMonth}
            onValueChange={setReferenceMonth}
            placeholder="Selecione o mês"
            className="w-full sm:w-auto"
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receita Planejada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {loading ? '...' : formatCurrency(planejamentoData.receitaPlanejada)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receita Realizada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                {loading ? '...' : formatCurrency(planejamentoData.receitaRealizada)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Planejado (Despesas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {loading ? '...' : formatCurrency(planejamentoData.totalPlanejado)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Gasto (Despesas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">
                {loading ? '...' : formatCurrency(planejamentoData.totalGasto)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo Previsto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                planejamentoData.saldoPrevisto >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {loading ? '...' : formatCurrency(planejamentoData.saldoPrevisto)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                planejamentoData.saldoAtual >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {loading ? '...' : formatCurrency(planejamentoData.saldoAtual)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Receitas Planejadas */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Receitas Planejadas</CardTitle>
              <Button onClick={() => handleAddPlanejamento('RECEITA')}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Planejamento de Receita
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {planejamentosReceita.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum planejamento de receita cadastrado para este mês.
              </p>
            ) : (
              <div className="space-y-4">
                {planejamentosReceita.map((category) => (
                  <div key={category.category_id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-medium">{category.category_name}</div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => category.items.length > 0 && handleEditPlanejamento(category.items[0])}
                          disabled={category.items.length === 0}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {category.items.map(item => (
                          <Button
                            key={item.id}
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeletePlanejamento(item.id)}
                            title={`Excluir: ${item.subcategory_name || 'Categoria geral'}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Planejado: </span>
                        <span className="font-medium">{formatCurrency(category.planned_amount)}</span>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Realizado: </span>
                        <span className="font-medium text-green-600">{formatCurrency(category.realizado)}</span>
                      </div>
                    </div>

                    {/* Show individual subcategory breakdowns */}
                    {category.items.length > 1 && (
                      <div className="mt-3 pl-4 border-l-2 border-muted">
                        <div className="text-xs text-muted-foreground mb-2">Detalhamento:</div>
                        {category.items.map(item => (
                          <div key={item.id} className="text-xs flex justify-between">
                            <span>{item.subcategory_name || 'Categoria geral'}</span>
                            <span>{formatCurrency(item.planned_amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Despesas Planejadas */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Despesas Planejadas</CardTitle>
              <Button onClick={() => handleAddPlanejamento('DESPESA')}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Planejamento de Despesa
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {planejamentosDespesa.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum planejamento de despesa cadastrado para este mês.
              </p>
            ) : (
              <div className="space-y-4">
                {planejamentosDespesa.map((category) => {
                  const percentage = category.planned_amount > 0 ? (category.realizado / category.planned_amount) * 100 : 0;
                  const remaining = category.planned_amount - category.realizado;
                  
                  return (
                    <div key={category.category_id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-medium">{category.category_name}</div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => category.items.length > 0 && handleEditPlanejamento(category.items[0])}
                            disabled={category.items.length === 0}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {category.items.map(item => (
                            <Button
                              key={item.id}
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeletePlanejamento(item.id)}
                              title={`Excluir: ${item.subcategory_name || 'Categoria geral'}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <span className="text-sm text-muted-foreground">Planejado: </span>
                          <span className="font-medium">{formatCurrency(category.planned_amount)}</span>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Gasto: </span>
                          <span className="font-medium text-red-600">{formatCurrency(category.realizado)}</span>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Restante: </span>
                          <span className={`font-medium ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(remaining)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progresso:</span>
                          <span>{formatPercentage(percentage)}</span>
                        </div>
                        <Progress 
                          value={Math.min(percentage, 100)} 
                          className={`h-2 ${
                            percentage > 100 ? '[&>div]:bg-red-500' : 
                            percentage > 80 ? '[&>div]:bg-yellow-500' : 
                            '[&>div]:bg-green-500'
                          }`}
                        />
                      </div>

                      {/* Show individual subcategory breakdowns */}
                      {category.items.length > 1 && (
                        <div className="mt-3 pl-4 border-l-2 border-muted">
                          <div className="text-xs text-muted-foreground mb-2">Detalhamento:</div>
                          {category.items.map(item => (
                            <div key={item.id} className="text-xs flex justify-between">
                              <span>{item.subcategory_name || 'Categoria geral'}</span>
                              <span>{formatCurrency(item.planned_amount)} / {formatCurrency(item.realizado)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <PlanejamentoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        type={modalType}
        editingItem={editingItem}
        referenceMonth={referenceMonth}
        onSaved={onPlanejamentoSaved}
      />
    </div>
  );
};

export default Planejamento;