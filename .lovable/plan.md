

## Plano: Corrigir dados do mês anterior no tooltip do gráfico de despesas

### Diagnóstico

O console log mostra `Total de transações históricas: 0`, porém existem **664 transações** no banco para os 3 meses anteriores. Isso indica que a query de transações históricas está falhando silenciosamente.

**Causa raiz**: Na linha 134 de `Index.tsx`, o código faz `historicalTransactionsResponse.data || []` sem verificar `historicalTransactionsResponse.error`. Se a query retorna erro, `data` é `null` e vira `[]` silenciosamente.

A query provavelmente falha porque o PostgREST não consegue resolver a relação `subcategories` no join embutido (não há foreign key explícita definida entre `transactions.subcategory_id` e `subcategories.id` no schema visível).

### Correção

**Arquivo: `src/pages/Index.tsx`**

1. **Adicionar log de erro** para `historicalTransactionsResponse` logo após a verificação do `currentTransactionsResponse` (após linha 132), para diagnosticar o erro exato.

2. **Corrigir a query histórica** — usar uma abordagem em 2 passos:
   - Buscar as transações históricas **sem** o join de `subcategories` (apenas `categories`), que já funcionava antes.
   - Para as transações do mês anterior (`previousMonths[0]`), buscar os nomes das subcategorias separadamente usando o `subcategory_id` já presente, ou fazer um join manual com uma query separada à tabela `subcategories`.
   
   **Alternativa mais simples** (preferida): Especificar a relação explicitamente no select usando a sintaxe `subcategories!subcategory_id(id, name)` para resolver a ambiguidade do PostgREST. Se isso também falhar, remover o join de `subcategories` da query histórica e buscar os nomes de subcategoria via lookup separado.

3. **Fallback robusto**: Se a query histórica falhar, logar o erro mas continuar o carregamento do dashboard normalmente (apenas sem dados de comparação).

### Arquivos modificados
- `src/pages/Index.tsx` — corrigir query histórica + adicionar tratamento de erro

### Abordagem de implementação

A correção será feita em dois passos:
1. Adicionar `console.error` para o erro da query histórica para confirmar a causa exata
2. Ajustar a query para resolver o problema (usar hint de FK ou separar a busca de subcategorias)

