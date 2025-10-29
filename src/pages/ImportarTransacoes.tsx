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
import { Upload, AlertCircle, CheckCircle, ArrowRight, Trash2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { Database } from '@/integrations/supabase/types';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { useSecurityValidation } from '@/hooks/useSecurityValidation';

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
  id?: string; // Temporary ID for tracking
}

export default function ImportarTransacoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { sanitizeInput, logSecurityEvent } = useSecurityValidation();
  
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
        supabase.from('investments').select('id, name').eq('user_id', user?.id).order('name', { ascending: true }),
        supabase.from('debts').select('id, description').eq('user_id', user?.id).gt('current_balance', 0).order('description', { ascending: true })
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
    // Sanitize CSV content
    const sanitizedCSV = sanitizeInput(csvText, 100000); // 100KB max
    
    const lines = sanitizedCSV.split('\n').filter(line => line.trim());
    const transactions: ParsedTransaction[] = [];

    // Auto-detect delimiter by analyzing the first few lines
    const detectDelimiter = (sampleLines: string[]): string => {
      const delimiters = [';', ',', '\t'];
      const scores: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };
      
      for (const line of sampleLines.slice(0, Math.min(3, sampleLines.length))) {
        for (const delimiter of delimiters) {
          const parts = line.split(delimiter);
          if (parts.length === 3) {
            scores[delimiter] += 10; // Strong preference for 3 columns
          } else if (parts.length > 1) {
            scores[delimiter] += parts.length;
          }
        }
      }
      
      // Return delimiter with highest score, defaulting to semicolon for Brazilian CSVs
      const bestDelimiter = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
      return bestDelimiter;
    };

    const delimiter = detectDelimiter(lines);
    console.log(`Detected CSV delimiter: "${delimiter}"`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV considering quoted fields
      const parseCSVLine = (line: string, delimiter: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          
          if (!inQuotes && (char === '"' || char === "'")) {
            inQuotes = true;
            quoteChar = char;
          } else if (inQuotes && char === quoteChar) {
            // Check if it's an escaped quote (doubled)
            if (line[j + 1] === quoteChar) {
              current += char;
              j++; // Skip next quote
            } else {
              inQuotes = false;
              quoteChar = '';
            }
          } else if (!inQuotes && char === delimiter) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        
        result.push(current.trim());
        return result;
      };

      const columns = parseCSVLine(line, delimiter);
      
      if (columns.length !== 3) {
        throw new Error(`Erro na linha ${i + 1}: esperadas 3 colunas (Data${delimiter}Descrição${delimiter}Valor), encontradas ${columns.length}. 
Linha atual: "${line}"
Colunas encontradas: ${JSON.stringify(columns)}
Verifique o formato do arquivo.`);
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

      // Parse amount - handle Brazilian decimal format more robustly
      let normalizedAmount = amountStr.trim();
      
      // Remove currency symbols and extra spaces
      normalizedAmount = normalizedAmount.replace(/[R$\s]+/g, '');
      
      // Handle various Brazilian number formats
      // Examples: "1.234,56", "1234,56", "1.234.567,89", "-1.234,56"
      
      // Count dots and commas to determine format
      const dotCount = (normalizedAmount.match(/\./g) || []).length;
      const commaCount = (normalizedAmount.match(/,/g) || []).length;
      
      if (commaCount === 1 && dotCount >= 1) {
        // Format like "1.234,56" or "12.345.678,90" - dots are thousands, comma is decimal
        const lastCommaIndex = normalizedAmount.lastIndexOf(',');
        const beforeComma = normalizedAmount.substring(0, lastCommaIndex);
        const afterComma = normalizedAmount.substring(lastCommaIndex + 1);
        
        // Remove dots (thousands separators) and replace comma with dot
        normalizedAmount = beforeComma.replace(/\./g, '') + '.' + afterComma;
      } else if (commaCount === 1 && dotCount === 0) {
        // Format like "1234,56" - comma is decimal separator
        normalizedAmount = normalizedAmount.replace(',', '.');
      } else if (commaCount === 0 && dotCount === 1) {
        // Format like "1234.56" - already in correct format
        // Do nothing
      } else if (commaCount === 0 && dotCount > 1) {
        // Format like "1.234.567" - dots are thousands separators, no decimals
        normalizedAmount = normalizedAmount.replace(/\./g, '');
      } else if (commaCount === 0 && dotCount === 0) {
        // Format like "1234" - integer value
        // Do nothing
      } else {
        // Ambiguous format - try to handle gracefully
        // Remove all dots and replace last comma with dot
        if (commaCount > 0) {
          const parts = normalizedAmount.split(',');
          const beforeLastComma = parts.slice(0, -1).join('').replace(/\./g, '');
          const afterLastComma = parts[parts.length - 1];
          normalizedAmount = beforeLastComma + '.' + afterLastComma;
        } else {
          normalizedAmount = normalizedAmount.replace(/\./g, '');
        }
      }
      
      const amount = parseFloat(normalizedAmount);
      if (isNaN(amount)) {
        throw new Error(`Erro na linha ${i + 1}: valor inválido "${amountStr}". Formatos suportados: 1.234,56 ou 1234,56 ou 1234.56`);
      }

      transactions.push({
        date: date.toISOString().split('T')[0],
        description: sanitizeInput(description.trim(), 200), // Sanitize and limit description
        amount: Math.abs(amount),
        type: amount < 0 ? 'Expense' : 'Income',
        id: `temp-${Date.now()}-${i}` // Temporary ID for tracking
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
          .select('current_balance, initial_amount')
          .eq('id', transactionData.investment_id)
          .single();

        if (investmentData) {
          let newBalance;
          const isFirstDeposit = investmentData.current_balance === 0 && transactionData.type === 'Expense';
          
          if (transactionData.type === 'Expense') {
            newBalance = investmentData.current_balance + transactionData.amount;
          } else {
            newBalance = Math.max(0, investmentData.current_balance - transactionData.amount);
          }

          // Se é o primeiro aporte, atualizar também o initial_amount
          if (isFirstDeposit) {
            await supabase
              .from('investments')
              .update({ 
                current_balance: newBalance,
                initial_amount: transactionData.amount
              })
              .eq('id', transactionData.investment_id);
          } else {
            await supabase
              .from('investments')
              .update({ current_balance: newBalance })
              .eq('id', transactionData.investment_id);
          }
        }
      }
    } catch (error) {
      console.error('Error updating patrimony balances:', error);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Enhanced file validation
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast({
          title: "Erro",
          description: "Por favor, selecione um arquivo CSV válido",
          variant: "destructive"
        });
        return;
      }

      // Check file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast({
          title: "Erro",
          description: "O arquivo é muito grande. Tamanho máximo permitido: 5MB",
          variant: "destructive"
        });
        return;
      }

      // Log file upload attempt
      logSecurityEvent('csv_upload_attempt', {
        filename: sanitizeInput(file.name),
        filesize: file.size,
        filetype: file.type
      });

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

      // Log successful CSV parsing
      await logSecurityEvent('csv_parsed_success', {
        filename: sanitizeInput(selectedFile.name),
        transactions_count: parsed.length,
        account_id: formData.account_id
      });

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
      
      // Log CSV parsing error
      await logSecurityEvent('csv_parsing_error', {
        filename: sanitizeInput(selectedFile.name),
        error: error.message
      });
      
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

  const handleDeleteTransaction = (index: number) => {
    const newTransactions = parsedTransactions.filter((_, i) => i !== index);
    const newCategories = transactionCategories.filter((_, i) => i !== index);
    setParsedTransactions(newTransactions);
    setTransactionCategories(newCategories);
  };

  const handleEditTransaction = (index: number, field: keyof ParsedTransaction, value: string | number) => {
    const newTransactions = [...parsedTransactions];
    if (field === 'amount') {
      newTransactions[index] = { ...newTransactions[index], [field]: parseFloat(value as string) };
    } else if (field === 'description') {
      // Sanitize edited description
      newTransactions[index] = { ...newTransactions[index], [field]: sanitizeInput(value as string, 200) };
    } else {
      newTransactions[index] = { ...newTransactions[index], [field]: value };
    }
    setParsedTransactions(newTransactions);
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

  // Month/Year picker - now dynamic, no need for fixed options

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
              <strong>Instruções para o arquivo CSV:</strong>
              <br />• <strong>3 colunas obrigatórias:</strong> Data, Descrição, Valor
              <br />• <strong>Separadores aceitos:</strong> vírgula (,), ponto e vírgula (;) ou tab
              <br />• <strong>Data:</strong> formato DD/MM/YYYY (ex: 15/03/2024)
              <br />• <strong>Valor:</strong> formato brasileiro com vírgula decimal (ex: 1.234,56 ou -50,25)
              <br />• <strong>Exemplo de linha:</strong> 15/03/2024,Compra supermercado,125,50
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
                  <MonthYearPicker
                    value={formData.reference_month}
                    onValueChange={(value) => setFormData({ ...formData, reference_month: value })}
                    placeholder="Selecione o mês de referência"
                  />
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
                  
                   <div className="space-y-4">
                     {parsedTransactions.map((transaction, index) => {
                       const categoryType = getCategoryType(transactionCategories[index]?.category_id || '');
                       const availableSubcategories = getSubcategoriesForCategory(transactionCategories[index]?.category_id || '');
                       
                       return (
                         <div key={index} className="border rounded-md p-4 space-y-4">
                           {/* Seção 1: Detalhes da Transação */}
                           <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
                             <div className="flex-shrink-0">
                               <Label htmlFor={`date-${index}`} className="text-sm font-medium">
                                 Data
                               </Label>
                               <Input
                                 id={`date-${index}`}
                                 type="date"
                                 value={transaction.date}
                                 onChange={(e) => handleEditTransaction(index, 'date', e.target.value)}
                                 className="w-full md:w-32"
                               />
                             </div>
                             
                             <div className="flex-grow min-w-0">
                               <Label htmlFor={`description-${index}`} className="text-sm font-medium">
                                 Descrição
                               </Label>
                               <Input
                                 id={`description-${index}`}
                                 value={transaction.description}
                                 onChange={(e) => handleEditTransaction(index, 'description', e.target.value)}
                                 className="w-full"
                               />
                             </div>
                             
                             <div className="flex-shrink-0">
                               <Label htmlFor={`amount-${index}`} className="text-sm font-medium">
                                 Valor
                               </Label>
                               <Input
                                 id={`amount-${index}`}
                                 type="number"
                                 step="0.01"
                                 value={transaction.amount}
                                 onChange={(e) => handleEditTransaction(index, 'amount', e.target.value)}
                                 className="w-full md:w-24"
                               />
                             </div>
                             
                             <div className="flex-shrink-0">
                               <Label htmlFor={`type-${index}`} className="text-sm font-medium">
                                 Tipo
                               </Label>
                               <Select
                                 value={transaction.type}
                                 onValueChange={(value) => handleEditTransaction(index, 'type', value)}
                               >
                                 <SelectTrigger className="w-full md:w-28">
                                   <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent className="bg-background">
                                   <SelectItem value="Expense">Despesa</SelectItem>
                                   <SelectItem value="Income">Receita</SelectItem>
                                 </SelectContent>
                               </Select>
                             </div>
                             
                             <div className="flex-shrink-0">
                               <Label className="text-sm font-medium">
                                 Ações
                               </Label>
                               <div>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => handleDeleteTransaction(index)}
                                   className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </div>
                             </div>
                           </div>
                           
                           {/* Seção 2: Campos de Categorização */}
                           <div className="flex flex-wrap gap-4">
                             <div className="flex-1 min-w-[200px]">
                               <Label htmlFor={`category-${index}`} className="text-sm font-medium">
                                 Categoria
                               </Label>
                               <Select
                                 value={transactionCategories[index]?.category_id || ''}
                                 onValueChange={(value) => handleCategoryChange(index, value)}
                               >
                                 <SelectTrigger>
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
                             </div>
                             
                             {availableSubcategories.length > 0 && (
                               <div className="flex-1 min-w-[200px]">
                                 <Label htmlFor={`subcategory-${index}`} className="text-sm font-medium">
                                   Subcategoria
                                 </Label>
                                 <Select
                                   value={transactionCategories[index]?.subcategory_id || ''}
                                   onValueChange={(value) => handleSubcategoryChange(index, value)}
                                 >
                                   <SelectTrigger>
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
                               </div>
                             )}
                             
                             {categoryType === 'Debt' && (
                               <div className="flex-1 min-w-[200px]">
                                 <Label htmlFor={`debt-${index}`} className="text-sm font-medium">
                                   Vincular a Dívida
                                 </Label>
                                 <Select
                                   value={transactionCategories[index]?.debt_id || ''}
                                   onValueChange={(value) => handlePatrimonyChange(index, 'debt_id', value)}
                                 >
                                   <SelectTrigger>
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
                               </div>
                             )}
                             
                             {categoryType === 'Investment' && (
                               <div className="flex-1 min-w-[200px]">
                                 <Label htmlFor={`investment-${index}`} className="text-sm font-medium">
                                   Vincular a Investimento
                                 </Label>
                                 <Select
                                   value={transactionCategories[index]?.investment_id || ''}
                                   onValueChange={(value) => handlePatrimonyChange(index, 'investment_id', value)}
                                 >
                                   <SelectTrigger>
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
                               </div>
                             )}
                           </div>
                         </div>
                       );
                     })}
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
