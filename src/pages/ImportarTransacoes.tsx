import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
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
  category_id: string;
  subcategory_id: string;
  investment_id: string;
  debt_id: string;
}

interface ParsedTransaction {
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
  const [step, setStep] = useState<'upload' | 'categorize'>('upload');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [transactionCategories, setTransactionCategories] = useState<CSVRow[]>([]);
  const [formData, setFormData] = useState<{
    account_id: string;
    reference_month: string;
  }>({
    account_id: '',
    reference_month: new Date().toISOString().slice(0, 7) + '-01'
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

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

  const fetchSubcategoriesForCategory = async (categoryId: number): Promise<Subcategory[]> => {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*')
        .eq('category_id', categoryId)
        .eq('user_id', user?.id);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching subcategories:', error);
      return [];
    }
  };

  const parseCSV = (csvText: string): ParsedTransaction[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    const transactions: ParsedTransaction[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let columns: string[] = [];
      
      // Try different delimiters
      const delimiters = [',', ';', '\t'];
      let bestDelimiter = ',';
      let maxColumns = 0;
      
      for (const delimiter of delimiters) {
        const testColumns = line.split(delimiter);
        if (testColumns.length > maxColumns) {
          maxColumns = testColumns.length;
          bestDelimiter = delimiter;
        }
      }
      
      // Parse with the best delimiter found
      const rawColumns = line.split(bestDelimiter);
      
      // Clean and process columns
      for (let col of rawColumns) {
        col = col.trim();
        // Remove surrounding quotes if present
        if ((col.startsWith('"') && col.endsWith('"')) || (col.startsWith("'") && col.endsWith("'"))) {
          col = col.slice(1, -1);
        }
        columns.push(col);
      }
      
      if (columns.length !== 3) {
        throw new Error(`Erro na linha ${i + 1}: esperadas 3 colunas, encontradas ${columns.length}. Verifique se o arquivo está no formato correto: Data,Descrição,Valor`);
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

      // Parse amount - handle Brazilian decimal format
      let normalizedAmount = amountStr;
      
      // Remove currency symbols and spaces
      normalizedAmount = normalizedAmount.replace(/[R$\s]/g, '');
      
      // Handle Brazilian number format: replace comma with dot for decimal
      // But only if there's exactly one comma and it's followed by 1-2 digits
      const commaMatch = normalizedAmount.match(/,(\d{1,2})$/);
      if (commaMatch) {
        normalizedAmount = normalizedAmount.replace(',', '.');
      }
      
      // Remove any remaining commas (thousands separators)
      normalizedAmount = normalizedAmount.replace(/,/g, '');
      
      const amount = parseFloat(normalizedAmount);
      if (isNaN(amount)) {
        throw new Error(`Erro na linha ${i + 1}: valor inválido "${amountStr}"`);
      }

      transactions.push({
        date: date.toISOString().split('T')[0],
        description: description.trim(),
        amount: Math.abs(amount),
        type: amount < 0 ? 'Expense' : 'Income'
      });
    }

    return transactions;
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
            newBalance = investmentData.current_balance + transactionData.amount;
          } else {
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

  const handleProcessFile = async () => {
    if (!selectedFile || !formData.account_id) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo CSV e uma conta de destino",
        variant: "destructive"
      });
      return;
    }

    try {
      const csvText = await selectedFile.text();
      const parsed = parseCSV(csvText);

      if (parsed.length === 0) {
        toast({
          title: "Erro",
          description: "O arquivo CSV está vazio ou não contém dados válidos",
          variant: "destructive"
        });
        return;
      }

      setParsedTransactions(parsed);
      // Initialize categories for each transaction
      const initCategories = parsed.map(() => ({
        date: '',
        description: '',
        amount: 0,
        type: 'Expense' as Database['public']['Enums']['transaction_type'],
        category_id: '',
        subcategory_id: '',
        investment_id: '',
        debt_id: ''
      }));
      setTransactionCategories(initCategories);
      setStep('categorize');
    } catch (error: any) {
      console.error('Error processing file:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar arquivo CSV",
        variant: "destructive"
      });
    }
  };

  const handleCategoryChange = async (index: number, categoryId: string) => {
    const newCategories = [...transactionCategories];
    newCategories[index] = {
      ...newCategories[index],
      category_id: categoryId,
      subcategory_id: '',
      investment_id: '',
      debt_id: ''
    };
    setTransactionCategories(newCategories);

    // Fetch subcategories for this category
    if (categoryId) {
      const subcats = await fetchSubcategoriesForCategory(parseInt(categoryId));
      setSubcategories(prevSubs => {
        const newSubs = [...prevSubs];
        // Clear existing subcategories for this category and add new ones
        const filtered = newSubs.filter(sub => sub.category_id !== parseInt(categoryId));
        return [...filtered, ...subcats];
      });
    }
  };

  const handleSubcategoryChange = (index: number, subcategoryId: string) => {
    const newCategories = [...transactionCategories];
    newCategories[index] = {
      ...newCategories[index],
      subcategory_id: subcategoryId
    };
    setTransactionCategories(newCategories);
  };

  const handlePatrimonyChange = (index: number, field: 'investment_id' | 'debt_id', value: string) => {
    const newCategories = [...transactionCategories];
    newCategories[index] = {
      ...newCategories[index],
      [field]: value
    };
    setTransactionCategories(newCategories);
  };

  const handleFinalImport = async () => {
    setImporting(true);

    try {
      const selectedAccount = accounts.find(a => a.id === parseInt(formData.account_id));
      let successCount = 0;

      for (let i = 0; i < parsedTransactions.length; i++) {
        const transaction = parsedTransactions[i];
        const categoryData = transactionCategories[i];

        // Validate category dependencies
        const selectedCategory = categories.find(c => c.id === parseInt(categoryData.category_id));
        
        if (selectedCategory?.type === 'Debt' && !categoryData.debt_id) {
          toast({
            title: "Erro",
            description: `Transação ${i + 1}: Para categorias de dívidas, é obrigatório vincular a uma dívida`,
            variant: "destructive"
          });
          setImporting(false);
          return;
        }

        if (selectedCategory?.type === 'Investment' && !categoryData.investment_id) {
          toast({
            title: "Erro",
            description: `Transação ${i + 1}: Para categorias de investimentos, é obrigatório vincular a um investimento`,
            variant: "destructive"
          });
          setImporting(false);
          return;
        }

        const transactionData = {
          description: transaction.description,
          amount: transaction.amount,
          type: transaction.type,
          transaction_date: transaction.date,
          reference_month: formData.reference_month,
          account_id: parseInt(formData.account_id),
          category_id: categoryData.category_id ? parseInt(categoryData.category_id) : null,
          subcategory_id: categoryData.subcategory_id ? parseInt(categoryData.subcategory_id) : null,
          investment_id: categoryData.investment_id ? parseInt(categoryData.investment_id) : null,
          debt_id: categoryData.debt_id ? parseInt(categoryData.debt_id) : null,
          user_id: user?.id
        };

        const { error } = await supabase
          .from('transactions')
          .insert([transactionData]);

        if (error) throw error;

        await updatePatrimonyBalances(transactionData);
        successCount++;
      }

      toast({
        title: "Sucesso",
        description: `Importação concluída! ${successCount} transações foram adicionadas à conta ${selectedAccount?.name}.`
      });

      // Reset everything
      setSelectedFile(null);
      setParsedTransactions([]);
      setTransactionCategories([]);
      setFormData({
        account_id: '',
        reference_month: new Date().toISOString().slice(0, 7) + '-01'
      });
      setStep('upload');
      
      // Reset file input
      const fileInput = document.getElementById('csv-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      console.error('Error importing transactions:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao importar transações",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  // Generate month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    const value = date.toISOString().slice(0, 7) + '-01';
    const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { value, label };
  });

  const getSubcategoriesForCategory = (categoryId: string) => {
    return subcategories.filter(sub => sub.category_id === parseInt(categoryId));
  };

  const getCategoryType = (categoryId: string) => {
    return categories.find(c => c.id === parseInt(categoryId))?.type;
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
        <div className="max-w-4xl mx-auto">
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

          {step === 'upload' && (
            <Card>
              <CardHeader>
                <CardTitle>Passo 1: Configuração Inicial</CardTitle>
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

                {/* Process File Button */}
                <div className="pt-4">
                  <Button 
                    onClick={handleProcessFile}
                    disabled={!selectedFile || !formData.account_id}
                    className="w-full"
                    size="lg"
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Processar Arquivo e Continuar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'categorize' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Passo 2: Categorizar Transações Individualmente</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Encontramos {parsedTransactions.length} transações no seu arquivo. 
                    Configure a categoria para cada uma individualmente:
                  </p>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Subcategoria</TableHead>
                          <TableHead>Vínculo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedTransactions.map((transaction, index) => {
                          const categoryType = getCategoryType(transactionCategories[index]?.category_id || '');
                          const availableSubcategories = getSubcategoriesForCategory(transactionCategories[index]?.category_id || '');
                          
                          return (
                            <TableRow key={index}>
                              <TableCell className="text-sm">
                                {new Date(transaction.date).toLocaleDateString('pt-BR')}
                              </TableCell>
                              <TableCell className="text-sm font-medium max-w-[200px] truncate">
                                {transaction.description}
                              </TableCell>
                              <TableCell className="text-sm">
                                R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  transaction.type === 'Income' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {transaction.type === 'Income' ? 'Receita' : 'Despesa'}
                                </span>
                              </TableCell>
                              <TableCell className="min-w-[150px]">
                                <Select
                                  value={transactionCategories[index]?.category_id || ''}
                                  onValueChange={(value) => handleCategoryChange(index, value)}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Categoria" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background">
                                    {categories.map((category) => (
                                      <SelectItem key={category.id} value={category.id.toString()}>
                                        {category.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="min-w-[150px]">
                                <Select
                                  value={transactionCategories[index]?.subcategory_id || ''}
                                  onValueChange={(value) => handleSubcategoryChange(index, value)}
                                  disabled={availableSubcategories.length === 0}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Subcategoria" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background">
                                    {availableSubcategories.map((subcategory) => (
                                      <SelectItem key={subcategory.id} value={subcategory.id.toString()}>
                                        {subcategory.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="min-w-[150px]">
                                {categoryType === 'Debt' && (
                                  <Select
                                    value={transactionCategories[index]?.debt_id || ''}
                                    onValueChange={(value) => handlePatrimonyChange(index, 'debt_id', value)}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Dívida" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background">
                                      {debts.map((debt) => (
                                        <SelectItem key={debt.id} value={debt.id.toString()}>
                                          {debt.description}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                {categoryType === 'Investment' && (
                                  <Select
                                    value={transactionCategories[index]?.investment_id || ''}
                                    onValueChange={(value) => handlePatrimonyChange(index, 'investment_id', value)}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Investimento" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background">
                                      {investments.map((investment) => (
                                        <SelectItem key={investment.id} value={investment.id.toString()}>
                                          {investment.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                {!categoryType && (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Voltar
                </Button>
                <Button 
                  onClick={handleFinalImport}
                  disabled={importing}
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
                      Finalizar Importação
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}