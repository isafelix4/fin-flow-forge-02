import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Trash2, Plus, Upload, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { TransactionModal } from '@/components/TransactionModal';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { Database } from '@/integrations/supabase/types';
import { Link } from 'react-router-dom';

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
}

interface Category {
  id: number;
  name: string;
}

interface Subcategory {
  id: number;
  name: string;
  category_id: number;
}

export default function Transacoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [sortBy, setSortBy] = useState<string>('transaction_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter states
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('all');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>('all');
  const [filterDescription, setFilterDescription] = useState<string>('');

  // Lookup data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  useEffect(() => {
    if (user) {
      fetchLookupData();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user, sortBy, sortOrder, filterMonth, filterType, filterAccountId, filterCategoryId, filterSubcategoryId, filterDescription]);

  const fetchLookupData = async () => {
    const [accountsRes, categoriesRes, subcategoriesRes] = await Promise.all([
      supabase.from('accounts').select('id, name').eq('user_id', user!.id).order('name'),
      supabase.from('categories').select('id, name').eq('user_id', user!.id).order('name'),
      supabase.from('subcategories').select('id, name, category_id').eq('user_id', user!.id).order('name'),
    ]);
    setAccounts(accountsRes.data || []);
    setCategories(categoriesRes.data || []);
    setSubcategories(subcategoriesRes.data || []);
  };

  const buildQuery = () => {
    let query = supabase
      .from('transactions')
      .select(`
        *,
        accounts(name),
        categories(name, type),
        subcategories(name),
        investments(name),
        debts(description)
      `)
      .eq('user_id', user!.id);

    if (filterMonth) {
      query = query.eq('reference_month', filterMonth);
    }
    if (filterType && filterType !== 'all') {
      query = query.eq('type', filterType as Database['public']['Enums']['transaction_type']);
    }
    if (filterAccountId && filterAccountId !== 'all') {
      query = query.eq('account_id', parseInt(filterAccountId));
    }
    if (filterCategoryId && filterCategoryId !== 'all') {
      query = query.eq('category_id', parseInt(filterCategoryId));
    }
    if (filterSubcategoryId && filterSubcategoryId !== 'all') {
      query = query.eq('subcategory_id', parseInt(filterSubcategoryId));
    }
    if (filterDescription.trim()) {
      query = query.ilike('description', `%${filterDescription.trim()}%`);
    }

    return query;
  };

  const fetchTransactions = async () => {
    try {
      if (sortBy === 'category_id' || sortBy === 'subcategory_id') {
        const { data, error } = await buildQuery();

        if (error) throw error;
        
        const sortedData = (data || []).sort((a, b) => {
          let aValue, bValue;
          
          if (sortBy === 'category_id') {
            aValue = a.categories?.name || '';
            bValue = b.categories?.name || '';
          } else {
            aValue = a.subcategories?.name || '';
            bValue = b.subcategories?.name || '';
          }
          
          if (sortOrder === 'asc') {
            return aValue.localeCompare(bValue, 'pt-BR');
          } else {
            return bValue.localeCompare(aValue, 'pt-BR');
          }
        });
        
        setTransactions(sortedData);
      } else {
        const { data, error } = await buildQuery()
          .order(sortBy, { ascending: sortOrder === 'asc' });

        if (error) throw error;
        setTransactions(data || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar transações",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  const revertTransactionImpact = async (transaction: Transaction) => {
    try {
      if (transaction.debt_id) {
        const { data: debtData } = await supabase
          .from('debts')
          .select('current_balance, remaining_installments')
          .eq('id', transaction.debt_id)
          .single();

        if (debtData) {
          const revertedBalance = debtData.current_balance + transaction.amount;
          const revertedInstallments = debtData.remaining_installments !== null 
            ? debtData.remaining_installments + 1 
            : null;

          await supabase
            .from('debts')
            .update({ 
              current_balance: revertedBalance,
              remaining_installments: revertedInstallments
            })
            .eq('id', transaction.debt_id);
        }
      }

      if (transaction.investment_id) {
        const { data: investmentData } = await supabase
          .from('investments')
          .select('current_balance')
          .eq('id', transaction.investment_id)
          .single();

        if (investmentData) {
          let revertedBalance;
          if (transaction.type === 'Expense') {
            revertedBalance = Math.max(0, investmentData.current_balance - transaction.amount);
          } else {
            revertedBalance = investmentData.current_balance + transaction.amount;
          }

          await supabase
            .from('investments')
            .update({ current_balance: revertedBalance })
            .eq('id', transaction.investment_id);
        }
      }
    } catch (error) {
      console.error('Error reverting transaction impact:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const { data: transactionToDelete, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (transactionToDelete) {
        await revertTransactionImpact(transactionToDelete);
      }

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Transação excluída com sucesso"
      });
      
      fetchTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast({
        title: "Erro", 
        description: "Erro ao excluir transação",
        variant: "destructive"
      });
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  };

  const handleTransactionSaved = () => {
    fetchTransactions();
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

  const clearFilters = () => {
    setFilterMonth('');
    setFilterType('all');
    setFilterAccountId('all');
    setFilterCategoryId('all');
    setFilterSubcategoryId('all');
    setFilterDescription('');
  };

  const hasActiveFilters = filterMonth || filterType !== 'all' || filterAccountId !== 'all' || filterCategoryId !== 'all' || filterSubcategoryId !== 'all' || filterDescription.trim();

  // Filter subcategories based on selected category
  const filteredSubcategories = filterCategoryId !== 'all'
    ? subcategories.filter(s => s.category_id === parseInt(filterCategoryId))
    : subcategories;

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
          <div className="flex gap-2">
            <Link to="/importar">
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Importar CSV
              </Button>
            </Link>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Transação
            </Button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-end">
              {/* Mês de Referência */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Mês de Referência</label>
                <MonthYearPicker
                  value={filterMonth || undefined}
                  onValueChange={(val) => setFilterMonth(val)}
                  placeholder="Todos os meses"
                  className="h-9 text-sm"
                />
              </div>

              {/* Tipo */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Income">Receita</SelectItem>
                    <SelectItem value="Expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conta */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Conta</label>
                <Select value={filterAccountId} onValueChange={setFilterAccountId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Categoria */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                <Select value={filterCategoryId} onValueChange={(val) => {
                  setFilterCategoryId(val);
                  setFilterSubcategoryId('all');
                }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subcategoria */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Subcategoria</label>
                <Select value={filterSubcategoryId} onValueChange={setFilterSubcategoryId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {filteredSubcategories.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Busca por descrição */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={filterDescription}
                    onChange={(e) => setFilterDescription(e.target.value)}
                    className="h-9 text-sm pl-8"
                  />
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                  <X className="h-4 w-4" />
                  Limpar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de Transações */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Transações ({transactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('reference_month')}
                    >
                      <div className="flex items-center">
                        Mês de Referência
                        {getSortIcon('reference_month')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('transaction_date')}
                    >
                      <div className="flex items-center">
                        Data
                        {getSortIcon('transaction_date')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('description')}
                    >
                      <div className="flex items-center">
                        Descrição
                        {getSortIcon('description')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('category_id')}
                    >
                      <div className="flex items-center">
                        Categoria
                        {getSortIcon('category_id')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('subcategory_id')}
                    >
                      <div className="flex items-center">
                        Subcategoria
                        {getSortIcon('subcategory_id')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('account_id')}
                    >
                      <div className="flex items-center">
                        Conta
                        {getSortIcon('account_id')}
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
                      onClick={() => handleSort('amount')}
                    >
                      <div className="flex items-center">
                        Valor
                        {getSortIcon('amount')}
                      </div>
                    </TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {new Date(transaction.reference_month + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        {new Date(transaction.transaction_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">{transaction.description}</TableCell>
                      <TableCell>{transaction.categories?.name || 'Sem categoria'}</TableCell>
                      <TableCell>{transaction.subcategories?.name || '-'}</TableCell>
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
                        <span className={`font-medium ${
                          transaction.type === 'Income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
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
                {hasActiveFilters ? 'Nenhuma transação encontrada com os filtros selecionados.' : 'Nenhuma transação cadastrada ainda.'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        transaction={editingTransaction}
        onTransactionSaved={handleTransactionSaved}
      />
    </div>
  );
}
