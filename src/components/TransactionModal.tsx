import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { MonthYearPicker } from '@/components/ui/month-year-picker';

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

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  onTransactionSaved?: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ 
  isOpen, 
  onClose, 
  transaction = null,
  onTransactionSaved 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState<{
    description: string;
    amount: string;
    type: Database['public']['Enums']['transaction_type'];
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
    type: 'Expense',
    transaction_date: new Date().toISOString().split('T')[0],
    reference_month: new Date().toISOString().slice(0, 7) + '-01',
    account_id: '',
    category_id: '',
    subcategory_id: '',
    investment_id: '',
    debt_id: ''
  });

  // Fetch initial data when modal opens
  useEffect(() => {
    if (isOpen && user) {
      fetchInitialData();
    }
  }, [isOpen, user]);

  // Populate form when editing transaction
  useEffect(() => {
    if (transaction) {
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
    } else {
      resetForm();
    }
  }, [transaction]);

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

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [accountsRes, categoriesRes, investmentsRes, debtsRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user?.id),
        supabase.from('categories').select('*').eq('user_id', user?.id),
        supabase.from('investments').select('id, name').eq('user_id', user?.id),
        supabase.from('debts').select('id, description').eq('user_id', user?.id).gt('current_balance', 0)
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (investmentsRes.error) throw investmentsRes.error;
      if (debtsRes.error) throw debtsRes.error;

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

  const updatePatrimonyBalances = async (transactionData: any, isEditing: boolean = false, oldTransaction: Transaction | null = null) => {
    try {
      // First, revert the impact of old transaction if editing
      if (isEditing && oldTransaction) {
        if (oldTransaction.debt_id) {
          const { data: debtData } = await supabase
            .from('debts')
            .select('current_balance, remaining_installments')
            .eq('id', oldTransaction.debt_id)
            .single();

          if (debtData) {
            // Revert debt payment - add back the amount
            const revertedBalance = debtData.current_balance + oldTransaction.amount;
            const revertedInstallments = debtData.remaining_installments !== null 
              ? debtData.remaining_installments + 1 
              : null;

            await supabase
              .from('debts')
              .update({ 
                current_balance: revertedBalance,
                remaining_installments: revertedInstallments
              })
              .eq('id', oldTransaction.debt_id);
          }
        }

        if (oldTransaction.investment_id) {
          const { data: investmentData } = await supabase
            .from('investments')
            .select('current_balance')
            .eq('id', oldTransaction.investment_id)
            .single();

          if (investmentData) {
            let revertedBalance;
            if (oldTransaction.type === 'Expense') {
              // Revert aporte - decrease balance
              revertedBalance = Math.max(0, investmentData.current_balance - oldTransaction.amount);
            } else {
              // Revert resgate - increase balance
              revertedBalance = investmentData.current_balance + oldTransaction.amount;
            }

            await supabase
              .from('investments')
              .update({ current_balance: revertedBalance })
              .eq('id', oldTransaction.investment_id);
          }
        }
      }

      // Now apply the new transaction impact
      if (transactionData.debt_id) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description || !formData.amount || !formData.account_id) {
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
        type: formData.type,
        transaction_date: formData.transaction_date,
        reference_month: formData.reference_month,
        account_id: parseInt(formData.account_id),
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        subcategory_id: formData.subcategory_id ? parseInt(formData.subcategory_id) : null,
        investment_id: formData.investment_id ? parseInt(formData.investment_id) : null,
        debt_id: formData.debt_id ? parseInt(formData.debt_id) : null,
        user_id: user?.id
      };

      if (transaction) {
        const { error } = await supabase
          .from('transactions')
          .update(transactionData)
          .eq('id', transaction.id);

        if (error) throw error;

        // Update investment/debt balances for editing (revert old, apply new)
        await updatePatrimonyBalances(transactionData, true, transaction);

        toast({
          title: "Sucesso",
          description: "Transação atualizada com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert([transactionData]);

        if (error) throw error;

        // Update investment/debt balances for new transaction
        await updatePatrimonyBalances(transactionData);

        toast({
          title: "Sucesso", 
          description: "Transação criada com sucesso"
        });
      }

      onClose();
      onTransactionSaved?.();
      if (!transaction) resetForm();
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar transação",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      type: 'Expense',
      transaction_date: new Date().toISOString().split('T')[0],
      reference_month: new Date().toISOString().slice(0, 7) + '-01',
      account_id: '',
      category_id: '',
      subcategory_id: '',
      investment_id: '',
      debt_id: ''
    });
  };

  const selectedCategory = categories.find(c => c.id === parseInt(formData.category_id));
  const showDebtField = selectedCategory?.type === 'Debt';
  const showInvestmentField = selectedCategory?.type === 'Investment';

  // Month/Year picker - now dynamic, no need for fixed options

  const handleClose = () => {
    onClose();
    if (!transaction) resetForm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transaction ? 'Editar Transação' : 'Nova Transação'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Carregando...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Transaction Type Tabs */}
            <Tabs
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value as Database['public']['Enums']['transaction_type'] })}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="Expense" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-800">
                  Despesa
                </TabsTrigger>
                <TabsTrigger value="Income" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800">
                  Receita
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className={`space-y-4 p-4 rounded-lg border-2 ${
              formData.type === 'Expense' 
                ? 'border-red-200 bg-red-50' 
                : 'border-green-200 bg-green-50'
            }`}>
              
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
                <Label htmlFor="transaction_date">Data *</Label>
                <Input
                  id="transaction_date"
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  required
                />
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
                  <Label htmlFor="investment_id">
                    {formData.type === 'Expense' ? 'Vincular a Ativo (Aporte) *' : 'Vincular a Ativo (Resgate) *'}
                  </Label>
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

              <div>
                <Label htmlFor="reference_month">Mês de Referência *</Label>
                <MonthYearPicker
                  value={formData.reference_month}
                  onValueChange={(value) => setFormData({ ...formData, reference_month: value })}
                  placeholder="Selecione o mês de referência"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit">
                {transaction ? 'Atualizar Transação' : 'Salvar Transação'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};