import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useReferenceMonth } from '@/contexts/ReferenceMonthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Edit, Trash2, Plus, TrendingUp, Wallet, DollarSign, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';

import { Database } from '@/integrations/supabase/types';

interface Investment {
  id: number;
  name: string;
  type: Database['public']['Enums']['investment_type'];
  initial_amount: number;
  current_balance: number;
  indicator?: string;
  rentabilidade?: number;
  created_at: string;
}

const INVESTMENT_TYPES = [
  { value: 'Fixed Income', label: 'Renda Fixa' },
  { value: 'Stocks', label: 'Ações' },
  { value: 'Real Estate Fund', label: 'Fundo Imobiliário' },
  { value: 'Cryptocurrency', label: 'Criptomoeda' },
  { value: 'Other', label: 'Outros' }
];

function Investimentos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { referenceMonth } = useReferenceMonth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [monthlyDeposits, setMonthlyDeposits] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [formData, setFormData] = useState<{
    name: string;
    type: Database['public']['Enums']['investment_type'] | '';
    indicator: string;
    rentabilidade: string;
    initial_amount: string;
    current_balance: string;
  }>({
    name: '',
    type: '',
    indicator: '',
    rentabilidade: '',
    initial_amount: '',
    current_balance: ''
  });

  useEffect(() => {
    if (user) {
      fetchInvestments();
      fetchMonthlyDeposits();
    }
  }, [user, sortBy, sortOrder, referenceMonth]);

  const fetchInvestments = async () => {
    try {
      let query = supabase
        .from('investments')
        .select('*')
        .eq('user_id', user?.id);

      // Handle sorting with NULL values for rentabilidade
      if (sortBy === 'rentabilidade') {
        if (sortOrder === 'asc') {
          query = query.order('rentabilidade', { ascending: true, nullsFirst: false });
        } else {
          query = query.order('rentabilidade', { ascending: false, nullsFirst: false });
        }
      } else {
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvestments(data || []);
    } catch (error) {
      console.error('Error fetching investments:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar investimentos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyDeposits = async () => {
    try {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user?.id)
        .eq('name', 'Investimentos')
        .single();

      if (categoriesError) {
        console.error('Error fetching Investimentos category:', categoriesError);
        return;
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user?.id)
        .eq('type', 'Expense')
        .eq('category_id', categoriesData.id)
        .eq('reference_month', referenceMonth);

      if (error) throw error;
      
      const total = data?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;
      setMonthlyDeposits(total);
    } catch (error) {
      console.error('Error fetching monthly deposits:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.type || !formData.initial_amount || !formData.current_balance) {
      toast({
        title: "Erro",
        description: "Todos os campos obrigatórios devem ser preenchidos",
        variant: "destructive"
      });
      return;
    }

    try {
      const investmentData = {
        name: formData.name,
        type: formData.type as Database['public']['Enums']['investment_type'],
        indicator: formData.indicator || null,
        rentabilidade: formData.rentabilidade ? parseFloat(formData.rentabilidade) : null,
        initial_amount: parseFloat(formData.initial_amount),
        current_balance: parseFloat(formData.current_balance),
        user_id: user?.id
      };

      if (editingInvestment) {
        const { error } = await supabase
          .from('investments')
          .update(investmentData)
          .eq('id', editingInvestment.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Investimento atualizado com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('investments')
          .insert([investmentData]);

        if (error) throw error;

        toast({
          title: "Sucesso", 
          description: "Investimento criado com sucesso"
        });
      }

      setIsModalOpen(false);
      setEditingInvestment(null);
      setFormData({ name: '', type: '', indicator: '', rentabilidade: '', initial_amount: '', current_balance: '' });
      fetchInvestments();
    } catch (error) {
      console.error('Error saving investment:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar investimento",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (investment: Investment) => {
    setEditingInvestment(investment);
    setFormData({
      name: investment.name,
      type: investment.type,
      indicator: investment.indicator || '',
      rentabilidade: investment.rentabilidade?.toString() || '',
      initial_amount: investment.initial_amount.toString(),
      current_balance: investment.current_balance.toString()
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('investments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Investimento excluído com sucesso"
      });
      
      fetchInvestments();
    } catch (error) {
      console.error('Error deleting investment:', error);
      toast({
        title: "Erro", 
        description: "Erro ao excluir investimento",
        variant: "destructive"
      });
    }
  };

  const totalCurrentBalance = investments.reduce((sum, inv) => sum + inv.current_balance, 0);
  const activeInvestments = investments.filter(inv => inv.current_balance > 0).length;
  
  // Calculate weighted average profitability
  const calculateAverageProfitability = () => {
    const investmentsWithProfitability = investments.filter(inv => inv.rentabilidade != null && inv.current_balance > 0);
    if (investmentsWithProfitability.length === 0) return 0;
    
    const totalWeightedProfitability = investmentsWithProfitability.reduce(
      (sum, inv) => sum + (inv.current_balance * (inv.rentabilidade || 0)), 0
    );
    const totalBalance = investmentsWithProfitability.reduce((sum, inv) => sum + inv.current_balance, 0);
    
    return totalBalance > 0 ? totalWeightedProfitability / totalBalance : 0;
  };
  
  const averageProfitability = calculateAverageProfitability();

  const getTypeLabel = (type: string) => {
    return INVESTMENT_TYPES.find(t => t.value === type)?.label || type;
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-2" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-2" />
      : <ArrowDown className="h-4 w-4 ml-2" />;
  };

  const allocationData = INVESTMENT_TYPES.map(type => {
    const typeInvestments = investments.filter(inv => inv.type === type.value);
    const totalBalance = typeInvestments.reduce((sum, inv) => sum + inv.current_balance, 0);
    return {
      name: type.label,
      value: totalBalance,
      count: typeInvestments.length
    };
  }).filter(item => item.value > 0);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  const chartConfig = {
    value: {
      label: "Valor",
      color: "hsl(var(--chart-1))",
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Meus Investimentos</h1>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingInvestment(null);
                setFormData({ name: '', type: '', indicator: '', rentabilidade: '', initial_amount: '', current_balance: '' });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Investimento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingInvestment ? 'Editar Investimento' : 'Adicionar Investimento'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome do Ativo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Tesouro Selic 2029"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Tipo de Investimento *</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value) => setFormData({ ...formData, type: value as Database['public']['Enums']['investment_type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {INVESTMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="indicator">Indicador</Label>
                  <Input
                    id="indicator"
                    value={formData.indicator}
                    onChange={(e) => setFormData({ ...formData, indicator: e.target.value })}
                    placeholder="Ex: PETR4, IBOV, CDI"
                  />
                </div>
                <div>
                  <Label htmlFor="rentabilidade">Rentabilidade (%)</Label>
                  <Input
                    id="rentabilidade"
                    type="number"
                    step="0.01"
                    value={formData.rentabilidade}
                    onChange={(e) => setFormData({ ...formData, rentabilidade: e.target.value })}
                    placeholder="Ex: 1.15"
                  />
                </div>
                <div>
                  <Label htmlFor="initial_amount">Valor Aplicado (Inicial) *</Label>
                  <Input
                    id="initial_amount"
                    type="number"
                    step="0.01"
                    value={formData.initial_amount}
                    onChange={(e) => setFormData({ ...formData, initial_amount: e.target.value })}
                    placeholder="0,00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="current_balance">Saldo Atual *</Label>
                  <Input
                    id="current_balance"
                    type="number"
                    step="0.01"
                    value={formData.current_balance}
                    onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                    placeholder="0,00"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingInvestment ? 'Atualizar Investimento' : 'Salvar Investimento'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalCurrentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quantidade de Ativos</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeInvestments}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aportes do Mês</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {monthlyDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rentabilidade Média</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${averageProfitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {averageProfitability.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
              </div>
              <p className="text-xs text-muted-foreground">Média ponderada da carteira</p>
            </CardContent>
          </Card>
        </div>

        {/* Allocation Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Alocação de Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <p className="text-muted-foreground">Carregando...</p>
              </div>
            ) : allocationData.length === 0 ? (
              <div className="h-80 flex items-center justify-center">
                <p className="text-muted-foreground">
                  Nenhum investimento encontrado
                </p>
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      innerRadius={60}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                    >
                      {allocationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Lista de Investimentos */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Investimentos</CardTitle>
          </CardHeader>
          <CardContent>
            {investments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Nome do Investimento
                        {getSortIcon('name')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center">
                        Tipo
                        {getSortIcon('type')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('indicator')}
                    >
                      <div className="flex items-center">
                        Indicador
                        {getSortIcon('indicator')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('initial_amount')}
                    >
                      <div className="flex items-center">
                        Valor Inicial
                        {getSortIcon('initial_amount')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('current_balance')}
                    >
                      <div className="flex items-center">
                        Saldo Atual
                        {getSortIcon('current_balance')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('rentabilidade')}
                    >
                      <div className="flex items-center">
                        Rentabilidade
                        {getSortIcon('rentabilidade')}
                      </div>
                    </TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map((investment) => (
                    <TableRow key={investment.id}>
                      <TableCell className="font-medium">{investment.name}</TableCell>
                      <TableCell>{getTypeLabel(investment.type)}</TableCell>
                      <TableCell>{investment.indicator || '-'}</TableCell>
                      <TableCell>
                        R$ {investment.initial_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        R$ {investment.current_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {investment.rentabilidade != null ? (
                          <span className={`font-medium ${investment.rentabilidade >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {investment.rentabilidade.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(investment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o investimento "{investment.name}"?
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(investment.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum investimento cadastrado ainda.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Investimentos;