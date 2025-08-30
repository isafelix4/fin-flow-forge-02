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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Trash2, Plus, TrendingDown, CreditCard, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';

import { Database } from '@/integrations/supabase/types';

interface Debt {
  id: number;
  description: string;
  type: Database['public']['Enums']['debt_type'];
  original_amount: number;
  current_balance: number;
  total_installments: number | null;
  remaining_installments: number | null;
  created_at: string;
}

const DEBT_TYPES = [
  { value: 'Financing', label: 'Financiamento' },
  { value: 'Loan', label: 'Empréstimo' },
  { value: 'Consortium', label: 'Consórcio' },
  { value: 'Credit Card', label: 'Cartão de Crédito' },
  { value: 'Other', label: 'Outros' }
];

function Dividas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [monthlyPayments, setMonthlyPayments] = useState<number>(0);
  const [formData, setFormData] = useState<{
    description: string;
    type: Database['public']['Enums']['debt_type'] | '';
    original_amount: string;
    current_balance: string;
    total_installments: string;
    remaining_installments: string;
  }>({
    description: '',
    type: '',
    original_amount: '',
    current_balance: '',
    total_installments: '',
    remaining_installments: ''
  });

  useEffect(() => {
    if (user) {
      fetchDebts();
      fetchMonthlyPayments();
    }
  }, [user]);

  const fetchDebts = async () => {
    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDebts(data || []);
    } catch (error) {
      console.error('Error fetching debts:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dívidas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyPayments = async (referenceMonth?: string) => {
    try {
      // Use current month if no reference month provided
      const targetMonth = referenceMonth || new Date().toISOString().slice(0, 7) + '-01';

      const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user?.id)
        .eq('type', 'Expense')
        .not('debt_id', 'is', null)
        .eq('reference_month', targetMonth);

      if (error) throw error;
      
      const total = data?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;
      setMonthlyPayments(total);
    } catch (error) {
      console.error('Error fetching monthly payments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description || !formData.type || !formData.original_amount || !formData.current_balance) {
      toast({
        title: "Erro",
        description: "Todos os campos obrigatórios devem ser preenchidos",
        variant: "destructive"
      });
      return;
    }

    try {
      const debtData = {
        description: formData.description,
        type: formData.type as Database['public']['Enums']['debt_type'],
        original_amount: parseFloat(formData.original_amount),
        current_balance: parseFloat(formData.current_balance),
        total_installments: formData.total_installments ? parseInt(formData.total_installments) : null,
        remaining_installments: formData.remaining_installments ? parseInt(formData.remaining_installments) : null,
        user_id: user?.id
      };

      if (editingDebt) {
        const { error } = await supabase
          .from('debts')
          .update(debtData)
          .eq('id', editingDebt.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Dívida atualizada com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('debts')
          .insert([debtData]);

        if (error) throw error;

        toast({
          title: "Sucesso", 
          description: "Dívida criada com sucesso"
        });
      }

      setIsModalOpen(false);
      setEditingDebt(null);
      setFormData({ 
        description: '', 
        type: '', 
        original_amount: '', 
        current_balance: '', 
        total_installments: '', 
        remaining_installments: '' 
      });
      fetchDebts();
    } catch (error) {
      console.error('Error saving debt:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar dívida",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setFormData({
      description: debt.description,
      type: debt.type,
      original_amount: debt.original_amount.toString(),
      current_balance: debt.current_balance.toString(),
      total_installments: debt.total_installments?.toString() || '',
      remaining_installments: debt.remaining_installments?.toString() || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('debts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dívida excluída com sucesso"
      });
      
      fetchDebts();
    } catch (error) {
      console.error('Error deleting debt:', error);
      toast({
        title: "Erro", 
        description: "Erro ao excluir dívida",
        variant: "destructive"
      });
    }
  };

  const totalOriginalAmount = debts.reduce((sum, debt) => sum + debt.original_amount, 0);
  const totalCurrentBalance = debts.reduce((sum, debt) => sum + debt.current_balance, 0);

  const getTypeLabel = (type: string) => {
    return DEBT_TYPES.find(t => t.value === type)?.label || type;
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
          <h1 className="text-3xl font-bold">Minhas Dívidas</h1>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingDebt(null);
                setFormData({ 
                  description: '', 
                  type: '', 
                  original_amount: '', 
                  current_balance: '', 
                  total_installments: '', 
                  remaining_installments: '' 
                });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Dívida
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingDebt ? 'Editar Dívida' : 'Adicionar Dívida'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="description">Descrição da Dívida *</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Financiamento do Apartamento"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Tipo de Dívida *</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value) => setFormData({ ...formData, type: value as Database['public']['Enums']['debt_type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {DEBT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="original_amount">Valor Original *</Label>
                  <Input
                    id="original_amount"
                    type="number"
                    step="0.01"
                    value={formData.original_amount}
                    onChange={(e) => setFormData({ ...formData, original_amount: e.target.value })}
                    placeholder="0,00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="current_balance">Saldo Devedor Atual *</Label>
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
                <div>
                  <Label htmlFor="total_installments">Número Total de Parcelas</Label>
                  <Input
                    id="total_installments"
                    type="number"
                    value={formData.total_installments}
                    onChange={(e) => setFormData({ ...formData, total_installments: e.target.value })}
                    placeholder="Ex: 360"
                  />
                </div>
                <div>
                  <Label htmlFor="remaining_installments">Parcelas Restantes</Label>
                  <Input
                    id="remaining_installments"
                    type="number"
                    value={formData.remaining_installments}
                    onChange={(e) => setFormData({ ...formData, remaining_installments: e.target.value })}
                    placeholder="Ex: 240"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingDebt ? 'Atualizar Dívida' : 'Salvar Dívida'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Original</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalOriginalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Devedor Atual</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalCurrentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Redução Mensal</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {monthlyPayments.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Dívidas */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Dívidas</CardTitle>
          </CardHeader>
          <CardContent>
            {debts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição da Dívida</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Saldo Devedor Atual</TableHead>
                    <TableHead>Parcelas Restantes</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debts.map((debt) => (
                    <TableRow key={debt.id}>
                      <TableCell className="font-medium">{debt.description}</TableCell>
                      <TableCell>{getTypeLabel(debt.type)}</TableCell>
                      <TableCell>
                        R$ {debt.current_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {debt.remaining_installments || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(debt)}
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
                                  Tem certeza que deseja excluir a dívida "{debt.description}"?
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(debt.id)}>
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
                Nenhuma dívida cadastrada ainda.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dividas;