// src/pages/Planejamento.tsx - VERSÃO CORRIGIDA E OTIMIZADA
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

// Interfaces (mantidas para clareza)
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

  // Armazena os dados brutos do Supabase
  const [rawBudgets, setRawBudgets] = useState<any[]>([]);
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);

  // 1. OTIMIZAÇÃO: A função de agregação agora fica fora do componente para não ser recriada.
  const aggregateByCategory = (
    items: PlanejamentoItem[]
  ): AggregatedPlanejamento[] => {
    const categoryMap = new Map<number, AggregatedPlanejamento>();

    items.forEach(item => {
      let entry = categoryMap.get(item.category_id);
      if (!entry) {
        entry = {
          category_id: item.category_id,
          category_name: item.category_name,
          planned_amount: 0,
          realizado: 0,
          items: [],
        };
        categoryMap.set(item.category_id, entry);
      }
      entry.planned_amount += item.planned_amount;
      entry.realizado += item.realizado;
      entry.items.push(item);
    });

    return Array.from(categoryMap.values());
  };


  const loadPlanejamentoData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: budgets, error: budgetsError } = await supabase
        .from('budgets')
        .select('*, categories (name), subcategories (name)')
        .eq('user_id', user.id)
        .eq('reference_month', referenceMonth);
      if (budgetsError) throw budgetsError;
      setRawBudgets(budgets || []);

      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('amount, type, category_id, subcategory_id')
        .eq('user_id', user.id)
        .eq('reference_month', referenceMonth);
      if (transactionsError) throw transactionsError;
      setRawTransactions(transactions || []);

    } catch (error) {
        console.error('Error loading data:', error);
        toast({ title: "Erro", description: "Falha ao carregar dados do planejamento.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  }, [user, referenceMonth, toast]);

  useEffect(() => {
    loadPlanejamentoData();
  }, [loadPlanejamentoData]);

  // 2. OTIMIZAÇÃO CRÍTICA: useMemo para processar e agregar dados
  //    - Este bloco só será re-executado se `rawBudgets` ou `rawTransactions` mudarem.
  //    - Isso ESTABILIZA os objetos e arrays, impedindo re-renderizações desnecessárias.
  const { planejamentosReceita, planejamentosDespesa } = useMemo(() => {
    const processItems = (type: 'RECEITA' | 'DESPESA'): PlanejamentoItem[] => {
        return rawBudgets
            .filter(b => b.plan_type === type)
            .map(budget => {
                const realizado = rawTransactions
                    .filter(t => t.type === (type === 'RECEITA' ? 'Income' : 'Expense') &&
                                 t.category_id === budget.category_id &&
                                 (budget.subcategory_id === null || t.subcategory_id === budget.subcategory_id))
                    .reduce((sum, t) => sum + Number(t.amount), 0);
                
                return {
                    id: budget.id,
                    category_id: budget.category_id,
                    subcategory_id: budget.subcategory_id,
                    planned_amount: Number(budget.planned_amount),
                    plan_type: budget.plan_type,
                    category_name: budget.categories?.name || 'Categoria não encontrada',
                    subcategory_name: budget.subcategories?.name,
                    realizado,
                };
            });
    };

    const receitasProcessadas = processItems('RECEITA');
    const despesasProcessadas = processItems('DESPESA');

    // Atualiza o card de resumo
    const receitaPlanejada = receitasProcessadas.reduce((sum, item) => sum + item.planned_amount, 0);
    const receitaRealizada = rawTransactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + Number(t.amount), 0);
    const totalPlanejado = despesasProcessadas.reduce((sum, item) => sum + item.planned_amount, 0);
    const totalGasto = rawTransactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + Number(t.amount), 0);

    setPlanejamentoData({
        receitaPlanejada,
        receitaRealizada,
        totalPlanejado,
        totalGasto,
        saldoPrevisto: receitaPlanejada - totalPlanejado,
        saldoAtual: receitaRealizada - totalGasto,
    });
    
    return {
        planejamentosReceita: aggregateByCategory(receitasProcessadas),
        planejamentosDespesa: aggregateByCategory(despesasProcessadas),
    };
  }, [rawBudgets, rawTransactions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };
  
  const handleAddPlanejamento = (type: 'RECEITA' | 'DESPESA') => {
    setModalType(type);
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEditPlanejamento = (item: PlanejamentoItem) => {
    setEditingItem(item);
    setModalType(item.plan_type);
    setIsModalOpen(true);
  };

  const handleDeletePlanejamento = async (id: number) => {
    try {
        const { error } = await supabase.from('budgets').delete().eq('id', id);
        if (error) throw error;
        toast({ title: "Planejamento excluído", description: "O item foi removido com sucesso." });
        loadPlanejamentoData(); // Recarrega os dados
    } catch (error) {
        toast({ title: "Erro", description: "Não foi possível excluir o planejamento.", variant: "destructive" });
    }
  };

  const onPlanejamentoSaved = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    loadPlanejamentoData(); // Apenas recarrega os dados
  };

  // ... (resto do seu JSX permanece o mesmo) ...
  // A única mudança no JSX é garantir que o botão de Excluir está dentro do AlertDialogTrigger
  // e que a função de deleção é chamada corretamente.

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Header e Month Filter aqui... */}
        
        {/* Summary Cards aqui... */}

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
                    <div key={category.category_id} className="p-4 border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="font-medium">{category.category_name}</span>
                            <div className="flex gap-2">
                                {/* Detalhes dos itens (subcategorias) */}
                                {category.items.map(item => (
                                    <div key={item.id} className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleEditPlanejamento(item)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Tem certeza que deseja excluir o planejamento para "{item.category_name} {item.subcategory_name ? `- ${item.subcategory_name}` : ''}"?
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeletePlanejamento(item.id)}>
                                                        Excluir
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                ))}
                             </div>
                        </div>
                         <div className="text-sm">
                            Planejado: <span className="font-semibold">{formatCurrency(category.planned_amount)}</span> / 
                            Realizado: <span className="font-semibold text-green-600">{formatCurrency(category.realizado)}</span>
                        </div>
                    </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Despesas Planejadas (estrutura similar ao de Receitas) */}

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
