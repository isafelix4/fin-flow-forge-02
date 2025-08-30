import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useReferenceMonth } from '@/contexts/ReferenceMonthContext';
import { FloatingTransactionButton } from '@/components/FloatingTransactionButton';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// Chart imports removed - now using GraficoDespesasInterativo component
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Upload, TrendingUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GraficoDespesasInterativo from '@/components/GraficoDespesasInterativo';

interface DashboardData {
  income: number;
  expenses: number;
  balance: number;
  netWorth: number;
  debtPayments: number;
  investmentContributions: number;
}

const Index = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { referenceMonth, setReferenceMonth } = useReferenceMonth();
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    income: 0,
    expenses: 0,
    balance: 0,
    netWorth: 0,
    debtPayments: 0,
    investmentContributions: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get transactions for the selected month with category type information
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          amount,
          type,
          categories (
            name,
            type
          )
        `)
        .eq('user_id', user.id)
        .eq('reference_month', referenceMonth);

      if (transactionsError) {
        console.error('Error fetching transactions:', transactionsError);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os dados do dashboard.",
          variant: "destructive"
        });
        return;
      }

      // Calculate totals
      const income = transactions
        ?.filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const expenses = transactions
        ?.filter(t => t.type === 'Expense')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // Calculate debt payments for the month
      const debtPayments = transactions
        ?.filter(t => t.type === 'Expense' && t.categories?.type === 'Debt')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // Calculate investment contributions for the month
      const investmentContributions = transactions
        ?.filter(t => t.type === 'Expense' && t.categories?.type === 'Investment')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // Get net worth (investments - debts)
      const [investmentsResponse, debtsResponse] = await Promise.all([
        supabase
          .from('investments')
          .select('current_balance')
          .eq('user_id', user.id),
        supabase
          .from('debts')
          .select('current_balance')
          .eq('user_id', user.id)
      ]);

      const totalInvestments = investmentsResponse.data?.reduce((sum, inv) => sum + Number(inv.current_balance), 0) || 0;
      const totalDebts = debtsResponse.data?.reduce((sum, debt) => sum + Number(debt.current_balance), 0) || 0;
      const netWorth = totalInvestments - totalDebts;

      setDashboardData({
        income,
        expenses,
        balance: income - expenses,
        netWorth,
        debtPayments,
        investmentContributions,
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
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
    loadDashboardData();
  }, [referenceMonth, user]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Financeiro</h1>
            <p className="text-muted-foreground">
              Olá, {user?.user_metadata?.nome || user?.email}!
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/importar">
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Importar CSV
              </Button>
            </Link>
            <FloatingTransactionButton />
          </div>
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

        {/* Summary Cards - 2x3 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Row 1: Receitas, Despesas, Saldo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {loading ? '...' : formatCurrency(dashboardData.income)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {loading ? '...' : formatCurrency(dashboardData.expenses)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                dashboardData.balance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {loading ? '...' : formatCurrency(dashboardData.balance)}
              </div>
            </CardContent>
          </Card>

          {/* Row 2: Pagamento de Dívidas, Aportes em Investimentos, Patrimônio Líquido */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pagamento de Dívidas
              </CardTitle>
              <p className="text-xs text-muted-foreground">Total pago no mês</p>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {loading ? '...' : formatCurrency(dashboardData.debtPayments)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aportes em Investimentos
              </CardTitle>
              <p className="text-xs text-muted-foreground">Total investido no mês</p>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {loading ? '...' : formatCurrency(dashboardData.investmentContributions)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Patrimônio Líquido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                dashboardData.netWorth >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {loading ? '...' : formatCurrency(dashboardData.netWorth)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <GraficoDespesasInterativo loading={loading} />
      </main>
    </div>
  );
};

export default Index;
