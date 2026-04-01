

## Plano: Novo tipo de categoria "Transferência"

### Resumo
Adicionar o valor `'Transfer'` ao enum `category_type` no banco de dados. Transações com categorias desse tipo serão **excluídas** dos KPIs do dashboard, gráfico de despesas e planejamento, mas **incluídas** no cálculo de entradas/saídas da tabela Resumo por Conta.

### Alteração de banco

Uma migration para adicionar o novo valor ao enum:

```sql
ALTER TYPE public.category_type ADD VALUE 'Transfer';
```

Nenhuma nova tabela. Nenhuma alteração em RLS.

### Arquivos modificados

#### 1. `src/pages/Index.tsx` — Excluir "Transfer" dos KPIs e gráfico

Nos cálculos de `income`, `expenses`, `debtPayments`, `investmentContributions` (linhas 144-147), adicionar filtro para excluir transações com `categories?.type === 'Transfer'`:

```ts
// Receitas: excluir Transfer
const income = currentTransactions
  .filter(t => t.type === 'Income' && t.categories?.type !== 'Transfer')
  .reduce(...);

// Despesas: excluir Transfer
const expenses = currentTransactions
  .filter(t => t.type === 'Expense' && t.categories?.type !== 'Transfer')
  .reduce(...);
```

Na preparação de `expenseData` para o gráfico (linha 277), filtrar:
```ts
.filter(t => t.type === 'Expense' && t.categories && t.categories.type !== 'Transfer')
```

Mesmo filtro para `previousMonthExpenses` (linha 287).

No processamento histórico (linhas 170-198), excluir transações Transfer dos totais de income/expenses/debt/investment.

#### 2. `src/pages/Planejamento.tsx` — Excluir categorias Transfer

Ao calcular `receitasRealizadas` e `despesasRealizadas`, verificar se a transação pertence a uma categoria Transfer e excluí-la. Isso requer buscar o tipo da categoria junto com as transações na query de `loadData`.

#### 3. `src/lib/insights.ts` / SQL function `get_category_insights` — Já exclui non-Standard

A função SQL de insights já filtra `c.type = 'Standard'`, então categorias Transfer são automaticamente excluídas. Nenhuma alteração necessária.

#### 4. `src/pages/Categorias.tsx` — Adicionar opção no formulário

Adicionar ao array `CATEGORY_TYPES`:
```ts
{ value: 'Transfer', label: 'Transferência' }
```

#### 5. `src/components/AccountSummaryTable.tsx` — Nenhuma alteração

O componente já soma todas as transações por conta independente do tipo de categoria. Transações Transfer continuarão contando normalmente no balanço por conta.

#### 6. `src/integrations/supabase/types.ts` — Atualização automática

Após a migration, o tipo será atualizado automaticamente pelo Supabase para incluir `'Transfer'` no enum.

### Impacto em outras telas

| Tela | Impacto |
|---|---|
| Dashboard KPIs | Transações Transfer excluídas dos totais |
| Gráfico despesas | Categorias Transfer não aparecem |
| Insights | Já excluídas (filtro `Standard` existente) |
| Planejamento | Transações Transfer excluídas dos realizados |
| Resumo por Conta | Sem alteração — continua incluindo tudo |
| Transações | Sem alteração — lista todas normalmente |
| Importar CSV | Sem alteração — novo tipo disponível via categorias |
| Categorias | Nova opção "Transferência" no select |

### Princípio de implementação
A exclusão é feita **no frontend**, adicionando `!== 'Transfer'` nos filtros relevantes. Isso evita alterar queries SQL ou estrutura de dados, minimizando risco de impacto colateral.

