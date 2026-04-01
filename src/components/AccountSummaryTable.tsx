import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { shiftReferenceMonth } from '@/lib/referenceMonth';
import { Skeleton } from '@/components/ui/skeleton';

interface AccountSummaryTableProps {
  referenceMonth: string;
  userId: string;
}

interface AccountRow {
  accountId: number;
  accountName: string;
  residualBalance: number;
  incomes: number;
  expenses: number;
  monthBalance: number;
  hasStoredResidual: boolean;
}

type SortKey = 'accountName' | 'residualBalance' | 'incomes' | 'expenses' | 'monthBalance';
type SortDir = 'asc' | 'desc';

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const AccountSummaryTable: React.FC<AccountSummaryTableProps> = ({ referenceMonth, userId }) => {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('accountName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editValues, setEditValues] = useState<Record<number, string>>({});

  const previousMonth = useMemo(() => shiftReferenceMonth(referenceMonth, -1), [referenceMonth]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [accountsRes, balancesCurrentRes, transactionsCurrentRes, balancesPrevRes, transactionsPrevRes] = await Promise.all([
        supabase.from('accounts').select('id, name').eq('user_id', userId),
        supabase.from('account_balances').select('account_id, residual_balance').eq('user_id', userId).eq('reference_month', referenceMonth),
        supabase.from('transactions').select('account_id, type, amount').eq('user_id', userId).eq('reference_month', referenceMonth),
        supabase.from('account_balances').select('account_id, residual_balance').eq('user_id', userId).eq('reference_month', previousMonth),
        supabase.from('transactions').select('account_id, type, amount').eq('user_id', userId).eq('reference_month', previousMonth),
      ]);

      const accounts = accountsRes.data || [];
      const balancesCurrent = balancesCurrentRes.data || [];
      const transactionsCurrent = transactionsCurrentRes.data || [];
      const balancesPrev = balancesPrevRes.data || [];
      const transactionsPrev = transactionsPrevRes.data || [];

      // Build lookup maps
      const currentBalanceMap = new Map<number, number>();
      balancesCurrent.forEach(b => currentBalanceMap.set(b.account_id, Number(b.residual_balance)));

      const prevBalanceMap = new Map<number, number>();
      balancesPrev.forEach(b => prevBalanceMap.set(b.account_id, Number(b.residual_balance)));

      // Compute previous month incomes/expenses per account
      const prevIncomeMap = new Map<number, number>();
      const prevExpenseMap = new Map<number, number>();
      transactionsPrev.forEach(t => {
        const amt = Math.abs(Number(t.amount));
        if (t.type === 'Income') {
          prevIncomeMap.set(t.account_id, (prevIncomeMap.get(t.account_id) || 0) + amt);
        } else {
          prevExpenseMap.set(t.account_id, (prevExpenseMap.get(t.account_id) || 0) + amt);
        }
      });

      // Current month incomes/expenses per account
      const incomeMap = new Map<number, number>();
      const expenseMap = new Map<number, number>();
      transactionsCurrent.forEach(t => {
        const amt = Math.abs(Number(t.amount));
        if (t.type === 'Income') {
          incomeMap.set(t.account_id, (incomeMap.get(t.account_id) || 0) + amt);
        } else {
          expenseMap.set(t.account_id, (expenseMap.get(t.account_id) || 0) + amt);
        }
      });

      const newRows: AccountRow[] = accounts.map(acc => {
        const incomes = incomeMap.get(acc.id) || 0;
        const expenses = expenseMap.get(acc.id) || 0;
        const hasStoredResidual = currentBalanceMap.has(acc.id);

        let residualBalance: number;
        if (hasStoredResidual) {
          residualBalance = currentBalanceMap.get(acc.id)!;
        } else {
          // Calculate from previous month: prevResidual + prevIncomes - prevExpenses
          const prevResidual = prevBalanceMap.get(acc.id) || 0;
          const prevInc = prevIncomeMap.get(acc.id) || 0;
          const prevExp = prevExpenseMap.get(acc.id) || 0;
          residualBalance = prevResidual + prevInc - prevExp;
        }

        return {
          accountId: acc.id,
          accountName: acc.name,
          residualBalance,
          incomes,
          expenses,
          monthBalance: incomes - expenses + residualBalance,
          hasStoredResidual,
        };
      });

      setRows(newRows);
      // Initialize edit values
      const edits: Record<number, string> = {};
      newRows.forEach(r => {
        edits[r.accountId] = r.residualBalance.toFixed(2);
      });
      setEditValues(edits);
    } catch (err) {
      console.error('Error loading account summary:', err);
      toast.error('Erro ao carregar resumo por conta');
    } finally {
      setLoading(false);
    }
  }, [referenceMonth, previousMonth, userId]);

  useEffect(() => {
    if (userId) loadData();
  }, [userId, loadData]);

  const handleSaveResidual = async (accountId: number) => {
    const raw = editValues[accountId];
    const value = parseFloat(raw?.replace(',', '.') || '0');
    if (isNaN(value)) {
      toast.error('Valor inválido');
      return;
    }

    const { error } = await supabase.from('account_balances').upsert(
      {
        user_id: userId,
        account_id: accountId,
        reference_month: referenceMonth,
        residual_balance: value,
      },
      { onConflict: 'user_id,account_id,reference_month' }
    );

    if (error) {
      console.error('Error saving residual balance:', error);
      toast.error('Erro ao salvar saldo residual');
    } else {
      toast.success('Saldo residual salvo');
      // Update local state
      setRows(prev =>
        prev.map(r =>
          r.accountId === accountId
            ? {
                ...r,
                residualBalance: value,
                monthBalance: r.incomes - r.expenses + value,
                hasStoredResidual: true,
              }
            : r
        )
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, accountId: number) => {
    if (e.key === 'Enter') handleSaveResidual(accountId);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let data = rows;
    if (filter) {
      const f = filter.toLowerCase();
      data = data.filter(r => r.accountName.toLowerCase().includes(f));
    }
    return [...data].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      const cmp = typeof valA === 'string'
        ? (valA as string).localeCompare(valB as string)
        : (valA as number) - (valB as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, filter, sortKey, sortDir]);

  const totals = useMemo(() => {
    return filteredAndSorted.reduce(
      (acc, r) => ({
        residual: acc.residual + r.residualBalance,
        incomes: acc.incomes + r.incomes,
        expenses: acc.expenses + r.expenses,
        balance: acc.balance + r.monthBalance,
      }),
      { residual: 0, incomes: 0, expenses: 0, balance: 0 }
    );
  }, [filteredAndSorted]);

  const SortButton = ({ column, label }: { column: SortKey; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 -ml-2 font-medium text-muted-foreground hover:text-foreground"
      onClick={() => toggleSort(column)}
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">Resumo por Conta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">Resumo por Conta</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar conta..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="pl-8 h-9 w-[180px]"
            />
          </div>
          {filter && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setFilter('')}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortButton column="accountName" label="Conta" /></TableHead>
                <TableHead className="text-right"><SortButton column="residualBalance" label="Saldo Residual" /></TableHead>
                <TableHead className="text-right"><SortButton column="incomes" label="Entradas" /></TableHead>
                <TableHead className="text-right"><SortButton column="expenses" label="Saídas" /></TableHead>
                <TableHead className="text-right"><SortButton column="monthBalance" label="Saldo do Mês" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma conta encontrada
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredAndSorted.map(row => (
                    <TableRow key={row.accountId}>
                      <TableCell className="font-medium">{row.accountName}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={editValues[row.accountId] ?? ''}
                          onChange={e =>
                            setEditValues(prev => ({ ...prev, [row.accountId]: e.target.value }))
                          }
                          onBlur={() => handleSaveResidual(row.accountId)}
                          onKeyDown={e => handleKeyDown(e, row.accountId)}
                          className="h-8 w-28 text-right ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(row.incomes)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(row.expenses)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${
                          row.monthBalance >= 0 ? 'text-green-600' : 'text-destructive'
                        }`}
                      >
                        {formatCurrency(row.monthBalance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="border-t-2 bg-muted/30 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.residual)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.incomes)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.expenses)}</TableCell>
                    <TableCell
                      className={`text-right ${totals.balance >= 0 ? 'text-green-600' : 'text-destructive'}`}
                    >
                      {formatCurrency(totals.balance)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccountSummaryTable;
