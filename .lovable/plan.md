

## Plano: Tabela Resumo por Conta na aba Início

### Posicionamento
A tabela será renderizada **após o gráfico de despesas** (linha 516), como última seção do dashboard.

### Alteração de banco necessária

Nova tabela `account_balances` para persistir o saldo residual editável:

```sql
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
```

### Arquivos

#### 1. Novo: `src/components/AccountSummaryTable.tsx`
- **Props**: `referenceMonth: string`, `userId: string`
- **Dados**: busca `accounts`, `account_balances` (mês atual), e `transactions` do mês atual — tudo com queries independentes ao Supabase
- **Colunas**:
  1. **Conta** — nome da conta
  2. **Saldo Residual** — campo editável (Input); pré-preenchido com `account_balances` do mês atual; se não existir, calcula saldo do mês anterior (entradas - saídas + residual anterior); upsert ao perder foco/Enter com `onConflict: 'user_id,account_id,reference_month'`
  3. **Entradas** — `SUM(amount)` de transações `type = 'Income'` da conta no mês
  4. **Saídas** — `SUM(amount)` de transações `type = 'Expense'` da conta no mês
  5. **Saldo do Mês** — Entradas - Saídas + Saldo Residual
- **Features**: filtro por nome da conta, ordenação por clique nos cabeçalhos, toast de sucesso/erro ao salvar residual
- **Usa helpers de `src/lib/referenceMonth.ts`** para calcular mês anterior (sem risco de timezone)

#### 2. Edição mínima: `src/pages/Index.tsx`
- Importar `AccountSummaryTable`
- Renderizar após a `div` do gráfico (linha 516), passando `referenceMonth` e `user.id`
- **Zero alteração** na lógica existente de KPIs, gráfico, insights ou dados do dashboard

### Impacto em outras telas
Nenhum. A tabela `account_balances` é nova, o componente é isolado, e a integração no Index é apenas um import + render.

