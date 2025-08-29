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
import { Edit, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { FloatingTransactionButton } from '@/components/FloatingTransactionButton';

import { Database } from '@/integrations/supabase/types';

interface Account {
  id: number;
  name: string;
  type: Database['public']['Enums']['account_type'];
  created_at: string;
}

const ACCOUNT_TYPES = [
  { value: 'Checking Account', label: 'Conta Corrente' },
  { value: 'Meal Voucher', label: 'Vale Alimentação' },
  { value: 'Cash', label: 'Dinheiro' },
  { value: 'Credit Card', label: 'Cartão de Crédito' },
  { value: 'Brokerage', label: 'Corretora' },
  { value: 'Other', label: 'Outros' }
];

export default function Contas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    type: Database['public']['Enums']['account_type'] | '';
  }>({
    name: '',
    type: ''
  });

  useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user]);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar contas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.type) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingAccount) {
        const { error } = await supabase
          .from('accounts')
          .update({
            name: formData.name,
            type: formData.type as Database['public']['Enums']['account_type']
          })
          .eq('id', editingAccount.id)
          .eq('user_id', user?.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Conta atualizada com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('accounts')
          .insert([{
            name: formData.name,
            type: formData.type as Database['public']['Enums']['account_type'],
            user_id: user?.id
          }]);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Conta criada com sucesso"
        });
      }

      setIsModalOpen(false);
      setEditingAccount(null);
      setFormData({ name: '', type: '' });
      fetchAccounts();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar conta",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (account: Account) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', account.id)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Conta excluída com sucesso"
      });
      
      fetchAccounts();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir conta",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', type: '' });
    setEditingAccount(null);
  };

  const getTypeLabel = (type: string) => {
    return ACCOUNT_TYPES.find(t => t.value === type)?.label || type;
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
        <h1 className="text-3xl font-bold">Minhas Contas</h1>
        <Dialog open={isModalOpen} onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? 'Editar Conta' : 'Nova Conta'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Conta *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Conta Banco do Brasil"
                  required
                />
              </div>
              <div>
                <Label htmlFor="type">Tipo da Conta *</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value: Database['public']['Enums']['account_type']) => 
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingAccount ? 'Atualizar Conta' : 'Salvar Conta'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome da Conta</TableHead>
              <TableHead>Tipo da Conta</TableHead>
              <TableHead>Data de Criação</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  Nenhuma conta cadastrada. Clique em "Adicionar Nova Conta" para começar.
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell>{getTypeLabel(account.type)}</TableCell>
                  <TableCell>{new Date(account.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(account)}
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
                              Você tem certeza que deseja excluir a conta "{account.name}"? 
                              Todas as transações associadas a ela também serão removidas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(account)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
    <FloatingTransactionButton />
  </div>
);
}