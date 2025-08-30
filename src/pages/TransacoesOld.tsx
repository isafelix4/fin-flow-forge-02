import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { Database } from '@/integrations/supabase/types';

interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: Database['public']['Enums']['transaction_type'];
  transaction_date: string;
  reference_month: string;
  account_id: number;
  category_id: number | null;
  subcategory_id: number | null;
  investment_id: number | null;
  debt_id: number | null;
  created_at: string;
  accounts?: { name: string };
  categories?: { name: string; type: Database['public']['Enums']['category_type'] };
  subcategories?: { name: string };
  investments?: { name: string };
  debts?: { description: string };
}

interface Account {
  id: number;
  name: string;
  type: Database['public']['Enums']['account_type'];
}

interface Category {
  id: number;
  name: string;
  type: Database['public']['Enums']['category_type'];
}

interface Subcategory {
  id: number;
  name: string;
  category_id: number;
}

interface Investment {
  id: number;
  name: string;
}

interface Debt {
  id: number;
  description: string;
}

export default function Transacoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState<{
    description: string;
    amount: string;
    type: Database['public']['Enums']['transaction_type'] | '';
    transaction_date: string;
    reference_month: string;
    account_id: string;
    category_id: string;
    subcategory_id: string;
    investment_id: string;
    debt_id: string;
  }>({
    description: '',
    amount: '',
    type: '',
    transaction_date: new Date().toISOString().split('T')[0],
    reference_month: new Date().toISOString().slice(0, 7) + '-01',
    account_id: '',
    category_id: '',
    subcategory_id: '',
    investment_id: '',
    debt_id: ''
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Update subcategories when category changes
  useEffect(() => {
    if (formData.category_id) {
      fetchSubcategories(parseInt(formData.category_id));
    } else {
      setSubcategories([]);
    }
    // Reset dependent fields
    setFormData(prev => ({ ...prev, subcategory_id: '', investment_id: '', debt_id: '' }));
  }, [formData.category_id]);

  const fetchData = async () => {
    try {
      const [transactionsRes, accountsRes, categoriesRes, investmentsRes, debtsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            *,
            accounts(name),
            categories(name, type),
            subcategories(name),
            investments(name),
            debts(description)
          `)
          .eq('user_id', user?.id)
          .order('transaction_date', { ascending: false }),
        supabase.from('accounts').select('*').eq('user_id', user?.id),
        supabase.from('categories').select('*').eq('user_id', user?.id),
        supabase.from('investments').select('id, name').eq('user_id', user?.id),
        supabase.from('debts').select('id, description').eq('user_id', user?.id)
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (investmentsRes.error) throw investmentsRes.error;
      if (debtsRes.error) throw debtsRes.error;

      setTransactions(transactionsRes.data || []);
      setAccounts(accountsRes.data || []);
      setCategories(categoriesRes.data || []);
      setInvestments(investmentsRes.data || []);
      setDebts(debtsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubcategories = async (categoryId: number) => {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*')
        .eq('category_id', categoryId)
        .eq('user_id', user?.id);

      if (error) throw error;
      setSubcategories(data || []);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description || !formData.amount || !formData.type || !formData.account_id) {
      toast({
        title: "Erro",
        description: "Todos os campos obrigatórios devem ser preenchidos",
        variant: "destructive"
      });
      return;
    }

    const selectedCategory = categories.find(c => c.id === parseInt(formData.category_id));
    
    // Validate heritage fields based on category type
    if (selectedCategory?.type === 'Debt' && !formData.debt_id) {
      toast({
        title: "Erro",
        description: "Para categorias de dívidas, é obrigatório vincular a uma dívida",
        variant: "destructive"
      });
      return;
    }

    if (selectedCategory?.type === 'Investment' && !formData.investment_id) {
      toast({
        title: "Erro",
        description: "Para categorias de investimentos, é obrigatório vincular a um investimento",
        variant: "destructive"
      });
      return;
    }

    try {
      const transactionData = {
        description: formData.description,
        amount: parseFloat(formData.amount),
        type: formData.type as Database['public']['Enums']['transaction_type'],
        transaction_date: formData.transaction_date,
        reference_month: formData.reference_month,
        account_id: parseInt(formData.account_id),
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        subcategory_id: formData.subcategory_id ? parseInt(formData.subcategory_id) : null,
        investment_id: formData.investment_id ? parseInt(formData.investment_id) : null,
        debt_id: formData.debt_id ? parseInt(formData.debt_id) : null,
        user_id: user?.id
      };

      if (editingTransaction) {
        const { error } = await supabase
          .from('transactions')
          .update(transactionData)
          .eq('id', editingTransaction.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Transação atualizada com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert([transactionData]);

        if (error) throw error;

        toast({
          title: "Sucesso", 
          description: "Transação criada com sucesso"
        });
      }

      // Update investment/debt balances based on transaction
      await updatePatrimonyBalances(transactionData);

      setIsModalOpen(false);
      setEditingTransaction(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar transação",
        variant: "destructive"
      });
    }
  };

  const updatePatrimonyBalances = async (transactionData: any) => {
    try {
      if (transactionData.debt_id) {
        // Update debt balance and remaining installments
        const { data: debtData } = await supabase
          .from('debts')
          .select('current_balance, remaining_installments')
          .eq('id', transactionData.debt_id)
          .single();

        if (debtData) {
          const newBalance = debtData.current_balance - transactionData.amount;
          const newRemainingInstallments = debtData.remaining_installments 
            ? Math.max(0, debtData.remaining_installments - 1) 
            : null;

          await supabase
            .from('debts')
            .update({ 
              current_balance: Math.max(0, newBalance),
              remaining_installments: newRemainingInstallments
            })
            .eq('id', transactionData.debt_id);
        }
      }

      if (transactionData.investment_id) {
        const { data: investmentData } = await supabase
          .from('investments')
          .select('current_balance')
          .eq('id', transactionData.investment_id)
          .single();

        if (investmentData) {
          let newBalance;
          if (transactionData.type === 'Expense') {
            // Aporte - increase balance
            newBalance = investmentData.current_balance + transactionData.amount;
          } else {
            // Resgate - decrease balance
            newBalance = Math.max(0, investmentData.current_balance - transactionData.amount);
          }

          await supabase
            .from('investments')
            .update({ current_balance: newBalance })
            .eq('id', transactionData.investment_id);
        }
      }
    } catch (error) {
      console.error('Error updating patrimony balances:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      type: '',
      transaction_date: new Date().toISOString().split('T')[0],
      reference_month: new Date().toISOString().slice(0, 7) + '-01',
      account_id: '',
      category_id: '',
      subcategory_id: '',
      investment_id: '',
      debt_id: ''
    });
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      description: transaction.description,
      amount: transaction.amount.toString(),
      type: transaction.type,
      transaction_date: transaction.transaction_date,
      reference_month: transaction.reference_month,
      account_id: transaction.account_id.toString(),
      category_id: transaction.category_id?.toString() || '',
      subcategory_id: transaction.subcategory_id?.toString() || '',
      investment_id: transaction.investment_id?.toString() || '',
      debt_id: transaction.debt_id?.toString() || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Transação excluída com sucesso"
      });
      
      fetchData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast({
        title: "Erro", 
        description: "Erro ao excluir transação",
        variant: "destructive"
      });
    }
  };

  const selectedCategory = categories.find(c => c.id === parseInt(formData.category_id));
  const showDebtField = selectedCategory?.type === 'Debt';
  const showInvestmentField = selectedCategory?.type === 'Investment';

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
          <h1 className="text-3xl font-bold">Transações</h1>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingTransaction(null);
                resetForm();
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingTransaction ? 'Editar Transação' : 'Nova Transação'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="description">Descrição *</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Compra no supermercado"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Valor *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0,00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Tipo *</Label>
                    <Select 
                      value={formData.type} 
                      onValueChange={(value) => setFormData({ ...formData, type: value as Database['public']['Enums']['transaction_type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="Income">Receita</SelectItem>
                        <SelectItem value="Expense">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="account_id">Conta *</Label>
                  <Select 
                    value={formData.account_id} 
                    onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="category_id">Categoria</Label>
                  <Select 
                    value={formData.category_id} 
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {subcategories.length > 0 && (
                  <div>
                    <Label htmlFor="subcategory_id">Subcategoria</Label>
                    <Select 
                      value={formData.subcategory_id} 
                      onValueChange={(value) => setFormData({ ...formData, subcategory_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a subcategoria" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {subcategories.map((subcategory) => (
                          <SelectItem key={subcategory.id} value={subcategory.id.toString()}>
                            {subcategory.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showDebtField && (
                  <div>
                    <Label htmlFor="debt_id">Vincular a Dívida *</Label>
                    <Select 
                      value={formData.debt_id} 
                      onValueChange={(value) => setFormData({ ...formData, debt_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a dívida" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {debts.map((debt) => (
                          <SelectItem key={debt.id} value={debt.id.toString()}>
                            {debt.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showInvestmentField && (
                  <div>
                    <Label htmlFor="investment_id">Vincular a Ativo *</Label>
                    <Select 
                      value={formData.investment_id} 
                      onValueChange={(value) => setFormData({ ...formData, investment_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o ativo" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {investments.map((investment) => (
                          <SelectItem key={investment.id} value={investment.id.toString()}>
                            {investment.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="transaction_date">Data da Transação</Label>
                    <Input
                      id="transaction_date"
                      type="date"
                      value={formData.transaction_date}
                      onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    />
                  </div>
                    <div>
                      <Label htmlFor="reference_month">Mês de Referência</Label>
                      <MonthYearPicker
                        value={formData.reference_month}
                        onValueChange={(value) => setFormData({ ...formData, reference_month: value })}
                        placeholder="Selecione o mês de referência"
                      />
                    </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingTransaction ? 'Atualizar Transação' : 'Salvar Transação'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de Transações */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Transações</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {new Date(transaction.transaction_date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">{transaction.description}</TableCell>
                      <TableCell>{transaction.categories?.name || 'Sem categoria'}</TableCell>
                      <TableCell>{transaction.accounts?.name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.type === 'Income' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.type === 'Income' ? 'Receita' : 'Despesa'}
                        </span>
                      </TableCell>
                      <TableCell>
                        R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(transaction)}
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
                                  Tem certeza que deseja excluir a transação "{transaction.description}"?
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(transaction.id)}>
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
                Nenhuma transação cadastrada ainda.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}