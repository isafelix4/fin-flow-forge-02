import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useReferenceMonth } from '@/contexts/ReferenceMonthContext';
import { FloatingTransactionButton } from '@/components/FloatingTransactionButton';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Upload, TrendingUp, Filter, ArrowUp, ArrowDown, Equal } from 'lucide-react';
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
interface HistoricalAverage {
  income: number;
  expenses: number;
  debtPayments: number;
  investmentContributions: number;
}
interface CategoryAverage {
  [categoryId: number]: {
    name: string;
    average: number;
  };
}
interface ExpenseData {
  categoryId: number;
  categoryName: string;
  categoryType: 'Standard' | 'Debt' | 'Investment';
  subcategoryId?: number;
  subcategoryName?: string;
  amount: number;
}
const Index = () => {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const {
    referenceMonth,
    setReferenceMonth
  } = useReferenceMonth();
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    income: 0,
    expenses: 0,
    balance: 0,
    netWorth: 0,
    debtPayments: 0,
    investmentContributions: 0
  });
  const [loading, setLoading] = useState(true);
  const [historicalAverage, setHistoricalAverage] = useState<HistoricalAverage>({
    income: 0,
    expenses: 0,
    debtPayments: 0,
    investmentContributions: 0
  });
  const [categoryAverages, setCategoryAverages] = useState<CategoryAverage>({});
  const [currentExpenseData, setCurrentExpenseData] = useState<ExpenseData[]>([]);
  const loadDashboardData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const referenceDate = new Date(referenceMonth);
      const previousMonths = [format(subMonths(referenceDate, 1), 'yyyy-MM-dd'), format(subMonths(referenceDate, 2), 'yyyy-MM-dd'), format(subMonths(referenceDate, 3), 'yyyy-MM-dd')];

      // Parallel queries for current month and historical data
      const [currentTransactionsResponse, historicalTransactionsResponse, investmentsResponse, debtsResponse, historicalInvestmentsResponse, historicalDebtsResponse] = await Promise.all([
      // Current month transactions with detailed category/subcategory info
      supabase.from('transactions').select(`
            amount,
            type,
            category_id,
            subcategory_id,
            categories (
              id,
              name,
              type
            ),
            subcategories (
              id,
              name
            )
          `).eq('user_id', user.id).eq('reference_month', referenceMonth),
      // Historical transactions for averages
      supabase.from('transactions').select(`
            amount,
            type,
            category_id,
            reference_month,
            categories (
              id,
              name,
              type
            )
          `).eq('user_id', user.id).in('reference_month', previousMonths),
      // Investments for net worth
      supabase.from('investments').select('current_balance').eq('user_id', user.id),
      // Debts for net worth
      supabase.from('debts').select('current_balance').eq('user_id', user.id),
      // Historical investments for historical net worth (we'll use current values as approximation)
      supabase.from('investments').select('current_balance').eq('user_id', user.id),
      // Historical debts for historical net worth (we'll use current values as approximation)
      supabase.from('debts').select('current_balance').eq('user_id', user.id)]);
      if (currentTransactionsResponse.error) {
        console.error('Error fetching current transactions:', currentTransactionsResponse.error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os dados do dashboard.",
          variant: "destructive"
        });
        return;
      }
      const currentTransactions = currentTransactionsResponse.data || [];
      const historicalTransactions = historicalTransactionsResponse.data || [];

      // Calculate current month totals
      const income = currentTransactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + Number(t.amount), 0);
      const expenses = currentTransactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + Number(t.amount), 0);
      const debtPayments = currentTransactions.filter(t => t.type === 'Expense' && t.categories?.type === 'Debt').reduce((sum, t) => sum + Number(t.amount), 0);
      const investmentContributions = currentTransactions.filter(t => t.type === 'Expense' && t.categories?.type === 'Investment').reduce((sum, t) => sum + Number(t.amount), 0);

      // Calculate historical averages
      const historicalByMonth = new Map<string, {
        income: number;
        expenses: number;
        debtPayments: number;
        investmentContributions: number;
        categories: Map<number, number>;
      }>();
      historicalTransactions.forEach(t => {
        const month = t.reference_month;
        if (!historicalByMonth.has(month)) {
          historicalByMonth.set(month, {
            income: 0,
            expenses: 0,
            debtPayments: 0,
            investmentContributions: 0,
            categories: new Map()
          });
        }
        const monthData = historicalByMonth.get(month)!;
        const amount = Number(t.amount);
        if (t.type === 'Income') {
          monthData.income += amount;
        } else if (t.type === 'Expense') {
          monthData.expenses += amount;
          // Track debt payments and investment contributions
          if (t.categories?.type === 'Debt') {
            monthData.debtPayments += amount;
          } else if (t.categories?.type === 'Investment') {
            monthData.investmentContributions += amount;
          }
          if (t.category_id) {
            const currentCategoryAmount = monthData.categories.get(t.category_id) || 0;
            monthData.categories.set(t.category_id, currentCategoryAmount + amount);
          }
        }
      });
      const monthsCount = historicalByMonth.size || 1;
      let totalHistoricalIncome = 0;
      let totalHistoricalExpenses = 0;
      let totalHistoricalDebtPayments = 0;
      let totalHistoricalInvestmentContributions = 0;
      const categoryTotals = new Map<number, {
        name: string;
        total: number;
      }>();
      historicalByMonth.forEach(monthData => {
        totalHistoricalIncome += monthData.income;
        totalHistoricalExpenses += monthData.expenses;
        totalHistoricalDebtPayments += monthData.debtPayments;
        totalHistoricalInvestmentContributions += monthData.investmentContributions;
        monthData.categories.forEach((amount, categoryId) => {
          const existing = categoryTotals.get(categoryId) || {
            name: '',
            total: 0
          };
          categoryTotals.set(categoryId, {
            name: existing.name,
            total: existing.total + amount
          });
        });
      });

      // Get category names from historical data
      historicalTransactions.forEach(t => {
        if (t.category_id && t.categories && categoryTotals.has(t.category_id)) {
          const existing = categoryTotals.get(t.category_id)!;
          existing.name = t.categories.name;
        }
      });
      const avgIncome = totalHistoricalIncome / monthsCount;
      const avgExpenses = totalHistoricalExpenses / monthsCount;
      const avgDebtPayments = totalHistoricalDebtPayments / monthsCount;
      const avgInvestmentContributions = totalHistoricalInvestmentContributions / monthsCount;
      
      const categoryAvgs: CategoryAverage = {};
      categoryTotals.forEach((data, categoryId) => {
        categoryAvgs[categoryId] = {
          name: data.name,
          average: data.total / monthsCount
        };
      });

      // Prepare expense data for chart
      const expenseData: ExpenseData[] = currentTransactions.filter(t => t.type === 'Expense' && t.categories).map(t => ({
        categoryId: t.categories!.id,
        categoryName: t.categories!.name,
        categoryType: t.categories!.type as 'Standard' | 'Debt' | 'Investment',
        subcategoryId: t.subcategory_id || undefined,
        subcategoryName: t.subcategories?.name || undefined,
        amount: Number(t.amount)
      }));

      // Calculate net worth
      const totalInvestments = investmentsResponse.data?.reduce((sum, inv) => sum + Number(inv.current_balance), 0) || 0;
      const totalDebts = debtsResponse.data?.reduce((sum, debt) => sum + Number(debt.current_balance), 0) || 0;
      const netWorth = totalInvestments - totalDebts;
      setDashboardData({
        income,
        expenses,
        balance: income - expenses,
        netWorth,
        debtPayments,
        investmentContributions
      });
      setHistoricalAverage({
        income: avgIncome,
        expenses: avgExpenses,
        debtPayments: avgDebtPayments,
        investmentContributions: avgInvestmentContributions
      });
      setCategoryAverages(categoryAvgs);
      setCurrentExpenseData(expenseData);
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
  const calculateVariation = (current: number, average: number) => {
    if (average === 0) return {
      percentage: 0,
      isIncrease: false,
      isStable: true
    };
    const percentage = (current - average) / average * 100;
    const isStable = Math.abs(percentage) < 5; // Consider stable if variation is less than 5%
    return {
      percentage: Math.abs(percentage),
      isIncrease: current > average,
      isStable
    };
  };

  const renderVariationIndicator = (current: number, average: number, isPositiveGood: boolean) => {
    if (!average || average === 0) return null;
    
    const variation = calculateVariation(current, average);
    let Icon, colorClass;
    
    if (variation.isStable) {
      Icon = Equal;
      colorClass = 'text-muted-foreground';
    } else {
      Icon = variation.isIncrease ? ArrowUp : ArrowDown;
      if (isPositiveGood) {
        colorClass = variation.isIncrease ? 'text-green-600' : 'text-red-600';
      } else {
        colorClass = variation.isIncrease ? 'text-red-600' : 'text-green-600';
      }
    }
    
    return (
      <div className="flex items-center gap-1 mt-1">
        <Icon className={`h-3 w-3 ${colorClass}`} />
        <p className={`text-xs ${colorClass}`}>
          {variation.percentage.toFixed(0)}% vs. média dos 3 meses
        </p>
      </div>
    );
  };
  const getMonthName = () => {
    const date = new Date(referenceMonth + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', { 
      month: 'long', 
      year: 'numeric' 
    });
  };
  return <div className="min-h-screen bg-background">
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
          <MonthYearPicker value={referenceMonth} onValueChange={setReferenceMonth} placeholder="Selecione o mês" className="w-full sm:w-auto" />
        </div>

        {/* Fluxo de Caixa Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Fluxo de Caixa de {getMonthName()}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Receitas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? '...' : formatCurrency(dashboardData.income)}
                </div>
                {!loading && renderVariationIndicator(dashboardData.income, historicalAverage.income, true)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Despesas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? '...' : formatCurrency(dashboardData.expenses)}
                </div>
                {!loading && renderVariationIndicator(dashboardData.expenses, historicalAverage.expenses, false)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Saldo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? '...' : formatCurrency(dashboardData.balance)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Saúde e Evolução Patrimonial Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Saúde e Evolução Patrimonial</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pagamento de Dívidas
                </CardTitle>
                <p className="text-xs text-muted-foreground">Total pago no mês</p>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? '...' : formatCurrency(dashboardData.debtPayments)}
                </div>
                {!loading && renderVariationIndicator(dashboardData.debtPayments, historicalAverage.debtPayments, false)}
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
                <div className="text-2xl font-bold text-foreground">
                  {loading ? '...' : formatCurrency(dashboardData.investmentContributions)}
                </div>
                {!loading && renderVariationIndicator(dashboardData.investmentContributions, historicalAverage.investmentContributions, true)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Patrimônio Líquido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? '...' : formatCurrency(dashboardData.netWorth)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Charts Section */}
        <div className="w-full">
          <GraficoDespesasInterativo loading={loading} expenseData={currentExpenseData} categoryAverages={categoryAverages} />
        </div>
      </main>
    </div>;
};
export default Index;