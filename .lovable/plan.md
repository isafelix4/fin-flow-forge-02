

## Plano de Correção: Saldo Anterior com valores incorretos

### Diagnóstico

Comparando `getPreviousMonthBalances` (em `previousMonthBalance.ts`) com a lógica do `AccountSummaryTable`, encontrei duas divergências que causam os valores incorretos:

**1. Falta de `Math.abs` nos valores de transações**
O `AccountSummaryTable` usa `Math.abs(Number(t.amount))` para garantir que valores de transações são sempre positivos antes de classificá-los como receita ou despesa. O `getPreviousMonthBalances` usa apenas `Number(t.amount)`, o que pode gerar cálculos errados se houver valores negativos no banco.

**2. Não consulta o saldo residual do mês atual**
O `AccountSummaryTable` prioriza o `residual_balance` armazenado para o mês ATUAL (que o usuário pode ter editado manualmente). Se não houver valor armazenado, calcula a partir do mês anterior. O `getPreviousMonthBalances` ignora completamente o mês atual e sempre calcula do zero usando dados de M-1, o que pode divergir do valor que o usuário vê no Resumo por Conta.

### Correção

**Arquivo:** `src/lib/previousMonthBalance.ts`

Alinhar a lógica com o `AccountSummaryTable`:

1. Adicionar uma query para `account_balances` do mês de referência ATUAL (além da query do mês anterior que já existe)
2. Para cada conta, priorizar o `residual_balance` armazenado para o mês atual (se existir), pois ele representa exatamente o saldo inicial do mês = saldo final do mês anterior
3. Só calcular a partir do mês anterior (`residual(M-1) + income(M-1) - expense(M-1)`) quando não houver valor armazenado para o mês atual
4. Usar `Math.abs()` nos valores de transações, igual ao `AccountSummaryTable`

**Impacto:** Apenas o arquivo `previousMonthBalance.ts` será alterado. Nenhuma mudança em `Index.tsx`, `Planejamento.tsx` ou `AccountSummaryTable.tsx`. A query adicional (account_balances do mês atual) será executada em paralelo com as existentes.

### Detalhes Técnicos

```text
Lógica atual (incorreta):
  saldo_anterior = residual(M-1) + income(M-1) - expense(M-1)

Lógica corrigida (alinhada com AccountSummaryTable):
  Para cada conta:
    SE account_balances(M) existe → saldo_anterior = residual(M)
    SENÃO → saldo_anterior = residual(M-1) + |income(M-1)| - |expense(M-1)|
  Agrupar por tipo de conta e somar
```

