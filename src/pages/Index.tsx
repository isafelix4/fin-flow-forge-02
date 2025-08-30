import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useReferenceMonth } from '@/contexts/ReferenceMonthContext';
import { FloatingTransactionButton } from '@/components/FloatingTransactionButton';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Upload, TrendingUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DashboardData {
  income: number;
  expenses: number;
  balance: number;
  netWorth: number;
  debtPayments: number;
  investmentContributions: number;
  categoryExpenses: Array<{
    name: string;
    amount: number;
    percentage: number;
  }>;
  subcategoryExpenses: Array<{
    name: string;
    amount: number;
    category: string;
  }>;
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
    categoryExpenses: [],
    subcategoryExpenses: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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
          ),
          subcategories (
            name
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

      // Calculate expenses by category
      const categoryMap = new Map<string, number>();
      transactions
        ?.filter(t => t.type === 'Expense' && t.categories?.name)
        .forEach(t => {
          const categoryName = t.categories!.name;
          const currentAmount = categoryMap.get(categoryName) || 0;
          categoryMap.set(categoryName, currentAmount + Number(t.amount));
        });

      const categoryExpenses = Array.from(categoryMap.entries())
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: expenses > 0 ? (amount / expenses) * 100 : 0
        }))
        .sort((a, b) => b.amount - a.amount);

      // Calculate expenses by subcategory - properly grouped
      const subcategoryMap = new Map<string, { amount: number, category: string }>();
      transactions
        ?.filter(t => t.type === 'Expense' && t.subcategories?.name)
        .forEach(t => {
          const subcategoryName = t.subcategories!.name;
          const categoryName = t.categories?.name || 'Sem categoria';
          const currentData = subcategoryMap.get(subcategoryName) || { amount: 0, category: categoryName };
          subcategoryMap.set(subcategoryName, {
            amount: currentData.amount + Number(t.amount),
            category: categoryName
          });
        });

      const subcategoryExpenses = Array.from(subcategoryMap.entries())
        .map(([name, data]) => ({
          name,
          amount: data.amount,
          category: data.category
        }))
        .sort((a, b) => b.amount - a.amount);

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
        categoryExpenses,
        subcategoryExpenses
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

  const chartConfig = {
    amount: {
      label: "Valor",
      color: "hsl(var(--chart-1))",
    },
  };

  const filteredSubcategoryExpenses = selectedCategory === 'all' 
    ? dashboardData.subcategoryExpenses
    : dashboardData.subcategoryExpenses.filter(sub => sub.category === selectedCategory);

  const availableCategories = Array.from(new Set(dashboardData.subcategoryExpenses.map(sub => sub.category)));

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expenses Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Despesas por Categoria</CardTitle>
            </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <p className="text-muted-foreground">Carregando...</p>
              </div>
            ) : dashboardData.categoryExpenses.length === 0 ? (
              <div className="h-80 flex items-center justify-center">
                <p className="text-muted-foreground">
                  Nenhuma despesa encontrada para o período selecionado
                </p>
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.categoryExpenses}>
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
                      labelFormatter={(label) => `Categoria: ${label}`}
                    />
                    <Bar 
                      dataKey="amount" 
                      fill="var(--color-amount)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
            </CardContent>
          </Card>

          {/* Subcategory Expenses Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Despesas por Subcategoria</CardTitle>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {availableCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-80 flex items-center justify-center">
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : filteredSubcategoryExpenses.length === 0 ? (
                <div className="h-80 flex items-center justify-center">
                  <p className="text-muted-foreground">
                    Nenhuma subcategoria encontrada para o filtro selecionado
                  </p>
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredSubcategoryExpenses}>
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
                        labelFormatter={(label) => `Subcategoria: ${label}`}
                      />
                      <Bar 
                        dataKey="amount" 
                        fill="var(--color-amount)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;
