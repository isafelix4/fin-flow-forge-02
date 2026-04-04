import { supabase } from '@/integrations/supabase/client';
import { shiftReferenceMonth } from '@/lib/referenceMonth';

const BALANCE_ACCOUNT_TYPES = ['Checking Account', 'Meal Voucher', 'Cash'] as const;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  'Checking Account': 'Contas Correntes',
  'Meal Voucher': 'Vale Alimentação',
  'Cash': 'Dinheiro',
};

export type PreviousBalanceByType = Record<string, number>;

export { BALANCE_ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS };

/**
 * Calculates the final balance of the previous month for each relevant account type.
 * Formula per account: residual_balance + incomes - expenses
 * Returns a record mapping account type to total balance (only non-zero values).
 */
export async function getPreviousMonthBalances(
  userId: string,
  referenceMonth: string
): Promise<PreviousBalanceByType> {
  const previousMonth = shiftReferenceMonth(referenceMonth, -1);

  const [accountsRes, currentBalancesRes, prevBalancesRes, prevTransactionsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, type')
      .eq('user_id', userId)
      .in('type', [...BALANCE_ACCOUNT_TYPES]),
    supabase
      .from('account_balances')
      .select('account_id, residual_balance')
      .eq('user_id', userId)
      .eq('reference_month', referenceMonth),
    supabase
      .from('account_balances')
      .select('account_id, residual_balance')
      .eq('user_id', userId)
      .eq('reference_month', previousMonth),
    supabase
      .from('transactions')
      .select('account_id, amount, type')
      .eq('user_id', userId)
      .eq('reference_month', previousMonth),
  ]);

  if (accountsRes.error || currentBalancesRes.error || prevBalancesRes.error || prevTransactionsRes.error) {
    console.error('Error fetching previous month balances:', {
      accounts: accountsRes.error,
      currentBalances: currentBalancesRes.error,
      prevBalances: prevBalancesRes.error,
      prevTransactions: prevTransactionsRes.error,
    });
    return {};
  }

  const accounts = accountsRes.data || [];
  const currentBalances = currentBalancesRes.data || [];
  const prevBalances = prevBalancesRes.data || [];
  const prevTransactions = prevTransactionsRes.data || [];

  // Build maps
  const currentBalanceMap = new Map<number, number>();
  currentBalances.forEach(b => currentBalanceMap.set(b.account_id, Number(b.residual_balance)));

  const prevResidualMap = new Map<number, number>();
  prevBalances.forEach(b => prevResidualMap.set(b.account_id, Number(b.residual_balance)));

  const prevIncomeMap = new Map<number, number>();
  const prevExpenseMap = new Map<number, number>();
  prevTransactions.forEach(t => {
    const amount = Math.abs(Number(t.amount));
    if (t.type === 'Income') {
      prevIncomeMap.set(t.account_id, (prevIncomeMap.get(t.account_id) || 0) + amount);
    } else {
      prevExpenseMap.set(t.account_id, (prevExpenseMap.get(t.account_id) || 0) + amount);
    }
  });

  // Group by account type
  const result: PreviousBalanceByType = {};
  accounts.forEach(account => {
    let balance: number;
    if (currentBalanceMap.has(account.id)) {
      // Prioritize stored residual for current month (same as AccountSummaryTable)
      balance = currentBalanceMap.get(account.id)!;
    } else {
      // Fallback: calculate from previous month data
      const prevResidual = prevResidualMap.get(account.id) || 0;
      const prevIncome = prevIncomeMap.get(account.id) || 0;
      const prevExpense = prevExpenseMap.get(account.id) || 0;
      balance = prevResidual + prevIncome - prevExpense;
    }

    const type = account.type as string;
    result[type] = (result[type] || 0) + balance;
  });

  return result;
}

/**
 * Returns the total previous month balance across all relevant account types.
 */
export function getTotalPreviousBalance(balances: PreviousBalanceByType): number {
  return Object.values(balances).reduce((sum, val) => sum + val, 0);
}
