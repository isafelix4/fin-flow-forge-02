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

  const [accountsRes, balancesRes, transactionsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, type')
      .eq('user_id', userId)
      .in('type', [...BALANCE_ACCOUNT_TYPES]),
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

  if (accountsRes.error || balancesRes.error || transactionsRes.error) {
    console.error('Error fetching previous month balances:', {
      accounts: accountsRes.error,
      balances: balancesRes.error,
      transactions: transactionsRes.error,
    });
    return {};
  }

  const accounts = accountsRes.data || [];
  const balances = balancesRes.data || [];
  const transactions = transactionsRes.data || [];

  // Build maps
  const residualMap = new Map<number, number>();
  balances.forEach(b => residualMap.set(b.account_id, Number(b.residual_balance)));

  const incomeMap = new Map<number, number>();
  const expenseMap = new Map<number, number>();
  transactions.forEach(t => {
    const amount = Number(t.amount);
    if (t.type === 'Income') {
      incomeMap.set(t.account_id, (incomeMap.get(t.account_id) || 0) + amount);
    } else {
      expenseMap.set(t.account_id, (expenseMap.get(t.account_id) || 0) + amount);
    }
  });

  // Group by account type
  const result: PreviousBalanceByType = {};
  accounts.forEach(account => {
    const residual = residualMap.get(account.id) || 0;
    const income = incomeMap.get(account.id) || 0;
    const expense = expenseMap.get(account.id) || 0;
    const finalBalance = residual + income - expense;

    const type = account.type as string;
    result[type] = (result[type] || 0) + finalBalance;
  });

  return result;
}

/**
 * Returns the total previous month balance across all relevant account types.
 */
export function getTotalPreviousBalance(balances: PreviousBalanceByType): number {
  return Object.values(balances).reduce((sum, val) => sum + val, 0);
}
