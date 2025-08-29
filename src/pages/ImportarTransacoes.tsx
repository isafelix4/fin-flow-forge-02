import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { Database } from '@/integrations/supabase/types';

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

interface CSVRow {
  date: string;
  description: string;
  amount: number;
  type: Database['public']['Enums']['transaction_type'];
}

export default function ImportarTransacoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<{
    account_id: string;
    category_id: string;
    subcategory_id: string;
    investment_id: string;
    debt_id: string;
    reference_month: string;
  }>({
    account_id: '',
    category_id: '',
    subcategory_id: '',
    investment_id: '',
    debt_id: '',
    reference_month: new Date().toISOString().slice(0, 7) + '-01'
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
      const [accountsRes, categoriesRes, investmentsRes, debtsRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user?.id),
        supabase.from('categories').select('*').eq('user_id', user?.id),
        supabase.from('investments').select('id, name').eq('user_id', user?.id),
        supabase.from('debts').select('id, description').eq('user_id', user?.id)
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

  const parseCSV = (csvText: string): CSVRow[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    const rows: CSVRow[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split by comma, but handle quoted fields that may contain commas
      const columns: string[] = [];
      let currentField = '';
      let insideQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          columns.push(currentField.trim().replace(/^"(.+)"$/, '$1'));
          currentField = '';
        } else {
          currentField += char;
        }
      }
      
      // Add the last field
      columns.push(currentField.trim().replace(/^"(.+)"$/, '$1'));
      
      if (columns.length !== 3) {
        throw new Error(`Erro na linha ${i + 1}: esperadas 3 colunas, encontradas ${columns.length}`);
      }

      const [dateStr, description, amountStr] = columns;

      // Parse date (DD/MM/YYYY format)
      const dateParts = dateStr.split('/');
      if (dateParts.length !== 3) {
        throw new Error(`Erro na linha ${i + 1}: formato de data inválido. Use DD/MM/YYYY`);
      }

      const [day, month, year] = dateParts;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      
      if (isNaN(date.getTime())) {
        throw new Error(`Erro na linha ${i + 1}: data inválida`);
      }

      // Parse amount - handle Brazilian decimal format (comma as decimal separator)
      // Replace comma with dot for decimal places
      let normalizedAmount = amountStr.replace(',', '.');
      
      // Handle thousands separators - remove dots that are not decimal separators
      // If there are multiple dots, keep only the last one as decimal separator
      const dotCount = (normalizedAmount.match(/\./g) || []).length;
      if (dotCount > 1) {
        const parts = normalizedAmount.split('.');
        const decimalPart = parts.pop(); // Last part is decimal
        const integerPart = parts.join(''); // Join all other parts
        normalizedAmount = integerPart + '.' + decimalPart;
      }
      
      const amount = parseFloat(normalizedAmount);
      if (isNaN(amount)) {
        throw new Error(`Erro na linha ${i + 1}: valor inválido "${amountStr}"`);
      }

      rows.push({
        date: date.toISOString().split('T')[0],
        description: description.trim(),
        amount: Math.abs(amount),
        type: amount < 0 ? 'Expense' : 'Income'
      });
    }

    return rows;
  };

  const updatePatrimonyBalances = async (transactionData: any) => {
    try {
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast({
          title: "Erro",
          description: "Por favor, selecione um arquivo CSV válido",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !formData.account_id) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo CSV e uma conta de destino",
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

    setImporting(true);

    try {
      const csvText = await selectedFile.text();
      const csvRows = parseCSV(csvText);

      if (csvRows.length === 0) {
        toast({
          title: "Erro",
          description: "O arquivo CSV está vazio ou não contém dados válidos",
          variant: "destructive"
        });
        return;
      }

      const selectedAccount = accounts.find(a => a.id === parseInt(formData.account_id));

      // Process each row
      let successCount = 0;
      for (const row of csvRows) {
        const transactionData = {
          description: row.description,
          amount: row.amount,
          type: row.type,
          transaction_date: row.date,
          reference_month: formData.reference_month,
          account_id: parseInt(formData.account_id),
          category_id: formData.category_id ? parseInt(formData.category_id) : null,
          subcategory_id: formData.subcategory_id ? parseInt(formData.subcategory_id) : null,
          investment_id: formData.investment_id ? parseInt(formData.investment_id) : null,
          debt_id: formData.debt_id ? parseInt(formData.debt_id) : null,
          user_id: user?.id
        };

        const { error } = await supabase
          .from('transactions')
          .insert([transactionData]);

        if (error) throw error;

        // Update investment/debt balances
        await updatePatrimonyBalances(transactionData);
        
        successCount++;
      }

      toast({
        title: "Sucesso",
        description: `Importação concluída! ${successCount} transações foram adicionadas à conta ${selectedAccount?.name}.`
      });

      // Reset form
      setSelectedFile(null);
      setFormData({
        account_id: '',
        category_id: '',
        subcategory_id: '',
        investment_id: '',
        debt_id: '',
        reference_month: new Date().toISOString().slice(0, 7) + '-01'
      });
      
      // Reset file input
      const fileInput = document.getElementById('csv-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      console.error('Error importing transactions:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar arquivo CSV",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const selectedCategory = categories.find(c => c.id === parseInt(formData.category_id));
  const showDebtField = selectedCategory?.type === 'Debt';
  const showInvestmentField = selectedCategory?.type === 'Investment';

  // Generate month options (current + next 11 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    const value = date.toISOString().slice(0, 7) + '-01';
    const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { value, label };
  });

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
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Importar Extrato</h1>
          
          {/* Instructions */}
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Instruções:</strong> Seu arquivo CSV precisa ter 3 colunas, nesta ordem: 
              <br />1. <strong>Data</strong> (formato DD/MM/YYYY)
              <br />2. <strong>Descrição</strong> (texto)
              <br />3. <strong>Valor</strong> (número - use vírgula como separador decimal. Valores negativos para despesas como -50,25 e positivos para receitas como 1200,00)
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Configuração da Importação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload */}
              <div>
                <Label htmlFor="csv-file">Arquivo CSV *</Label>
                <div className="mt-2">
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {selectedFile && (
                    <div className="mt-2 flex items-center text-sm text-green-600">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Arquivo selecionado: {selectedFile.name}
                    </div>
                  )}
                </div>
              </div>

              {/* Target Account */}
              <div>
                <Label htmlFor="account_id">Para qual conta você deseja importar estas transações? *</Label>
                <Select 
                  value={formData.account_id} 
                  onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta de destino" />
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

              {/* Reference Month */}
              <div>
                <Label htmlFor="reference_month">Mês de Referência *</Label>
                <Select 
                  value={formData.reference_month} 
                  onValueChange={(value) => setFormData({ ...formData, reference_month: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês de referência" />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {monthOptions.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div>
                <Label htmlFor="category_id">Categoria (Opcional)</Label>
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

              {/* Subcategory */}
              {subcategories.length > 0 && (
                <div>
                  <Label htmlFor="subcategory_id">Subcategoria (Opcional)</Label>
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

              {/* Debt Field */}
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

              {/* Investment Field */}
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

              {/* Import Button */}
              <div className="pt-4">
                <Button 
                  onClick={handleImport}
                  disabled={importing || !selectedFile || !formData.account_id}
                  className="w-full"
                  size="lg"
                >
                  {importing ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Transações
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}