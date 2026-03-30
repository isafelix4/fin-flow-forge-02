
CREATE TABLE public.account_balances (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  account_id bigint NOT NULL,
  reference_month date NOT NULL,
  residual_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_id, reference_month)
);

ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account_balances" ON public.account_balances
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own account_balances" ON public.account_balances
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own account_balances" ON public.account_balances
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own account_balances" ON public.account_balances
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Deny anonymous access to account_balances" ON public.account_balances
  FOR ALL TO anon USING (false);
