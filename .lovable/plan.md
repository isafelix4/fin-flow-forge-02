

## Plano: Saldo Anterior no Dashboard e Planejamento

### Contexto

Ambas as melhorias dependem de um mesmo dado: o **saldo final do mes anterior** por tipo de conta (`Checking Account`, `Meal Voucher`, `Cash`). O saldo final de uma conta no mes anterior e calculado como: `saldo_residual + receitas - despesas` (mesma logica ja usada no `AccountSummaryTable`).

---

### Melhoria 1 -- Card "Saldo Anterior" no Dashboard (Index.tsx)

**O que muda:**
- Na secao "Fluxo de Caixa", adicionar um card **antes** de "Receitas" com o titulo "Saldo Anterior"
- Esse card mostra a soma do saldo final do mes anterior das contas dos tipos: Checking Account, Meal Voucher e Cash
- O grid passa de `md:grid-cols-3` para `md:grid-cols-4`
- O calculo do card "Saldo" muda para: `Saldo Anterior + Receitas - Despesas`

**Dados necessarios (novas queries no `loadDashboardData`):**
1. Buscar contas do usuario filtrando `type IN ('Checking Account', 'Meal Voucher', 'Cash')`
2. Buscar `account_balances` do mes anterior (`previousMonths[0]`) para essas contas
3. Buscar transacoes do mes anterior para essas contas (para calcular saldo final quando nao ha `account_balances` salvo)
4. Calcular: para cada conta, `residual + incomes - expenses` do mes anterior; somar tudo

**Arquivo:** `src/pages/Index.tsx`

---

### Melhoria 2 -- Linhas de "Saldo Anterior" no Planejamento (Planejamento.tsx)

**O que muda:**
- Na tabela de "Receitas Planejadas", adicionar linhas read-only (sem input, sem botao de excluir) para cada tipo de conta que tenha saldo anterior diferente de zero
- Formato: "Saldo Anterior - Contas Correntes", "Saldo Anterior - Vale Alimentacao", "Saldo Anterior - Dinheiro"
- Tanto "Planejado" quanto "Realizado" mostram o mesmo valor (o saldo total do mes anterior para aquele tipo de conta)
- Essas linhas sao incluidas nos totais de `receitasPlanejadas` e `receitasRealizadas`

**Dados necessarios (novas queries no `loadData`):**
1. Mesma logica da melhoria 1: buscar contas, balances e transacoes do mes anterior
2. Agrupar por tipo de conta e somar os saldos finais
3. Armazenar em novo state (ex: `previousBalanceByType`)

**Arquivo:** `src/pages/Planejamento.tsx`

---

### Detalhes Tecnicos

**Funcao compartilhada** -- Criar um utilitario reutilizavel (ex: `src/lib/previousMonthBalance.ts`) que:
- Recebe `userId` e `referenceMonth`
- Faz as 3 queries em paralelo (accounts filtradas, account_balances do mes anterior, transactions do mes anterior)
- Retorna `Record<string, number>` mapeando tipo de conta para saldo total (ex: `{ 'Checking Account': 5000, 'Meal Voucher': 200, 'Cash': 0 }`)
- Filtra apenas os tipos relevantes: `Checking Account`, `Meal Voucher`, `Cash`

**Impacto na performance:**
- 3 queries adicionais por pagina, executadas em paralelo com as queries existentes via `Promise.all`
- Nenhuma alteracao no banco de dados (sem migrations)
- Nenhum impacto nas funcionalidades existentes

**Resumo de arquivos:**
1. `src/lib/previousMonthBalance.ts` -- novo utilitario compartilhado
2. `src/pages/Index.tsx` -- novo card + calculo de saldo atualizado
3. `src/pages/Planejamento.tsx` -- linhas read-only de saldo anterior na tabela de receitas

