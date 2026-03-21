

## Plano: Variação vs mês anterior no tooltip do gráfico de despesas

### Resumo
Substituir a média de 3 meses no tooltip do gráfico por comparação direta com o mês anterior. Aplica-se tanto a categorias quanto subcategorias.

**Tooltip final:**
```text
Nome da Categoria
Mês atual: R$1.000,00 (+33,3%)
Mês anterior: R$750,00
```

### Nenhuma alteração de banco necessária

### Alterações

**Arquivo 1: `src/pages/Index.tsx`**

1. Adicionar `subcategory_id` e `subcategories(id, name)` à query de transações históricas (linha 99-109) para ter dados de subcategoria do mês anterior.

2. Após processar `historicalTransactions` (após linha 276), extrair as transações do mês imediatamente anterior (`previousMonths[0]`) e montar um array `previousMonthExpenseData: ExpenseData[]`:
```ts
const previousMonthExpenses: ExpenseData[] = historicalTransactions
  .filter(t => t.reference_month === previousMonths[0] && t.type === 'Expense' && t.categories)
  .map(t => ({
    categoryId: t.categories!.id,
    categoryName: t.categories!.name,
    categoryType: t.categories!.type as 'Standard' | 'Debt' | 'Investment',
    subcategoryId: t.subcategory_id || undefined,
    subcategoryName: t.subcategories?.name || undefined,
    amount: Number(t.amount)
  }));
```

3. Criar novo state `previousMonthExpenseData` (junto aos outros states, linha 72):
```ts
const [previousMonthExpenseData, setPreviousMonthExpenseData] = useState<ExpenseData[]>([]);
```

4. Setar o state após calcular (junto ao `setCurrentExpenseData`):
```ts
setPreviousMonthExpenseData(previousMonthExpenses);
```

5. Atualizar a chamada do componente (linha 499) para passar a nova prop e remover `categoryAverages`:
```tsx
<GraficoDespesasInterativo 
  loading={loading} 
  expenseData={currentExpenseData} 
  previousMonthExpenseData={previousMonthExpenseData} 
/>
```

6. O state `categoryAverages` e toda a lógica de cálculo de médias por categoria (linhas 211-261, 296) podem ser mantidos pois são usados em outros contextos (ou removidos se não forem usados em mais nenhum lugar — verificar antes).

---

**Arquivo 2: `src/components/GraficoDespesasInterativo.tsx`**

1. **Props**: substituir `categoryAverages: CategoryAverage` por `previousMonthExpenseData: ExpenseData[]`. Remover interface `CategoryAverage`.

2. **useMemo para lookup do mês anterior por categoria:**
```ts
const previousByCategoryMap = useMemo(() => {
  const map = new Map<number, number>();
  previousMonthExpenseData.forEach(e => {
    map.set(e.categoryId, (map.get(e.categoryId) || 0) + e.amount);
  });
  return map;
}, [previousMonthExpenseData]);
```

3. **useMemo para lookup do mês anterior por subcategoria** (filtrando pela categoria selecionada):
```ts
const previousBySubcategoryMap = useMemo(() => {
  const map = new Map<string, number>();
  if (!selectedCategory) return map;
  previousMonthExpenseData
    .filter(e => e.categoryId === selectedCategory.id && e.subcategoryName)
    .forEach(e => {
      map.set(e.subcategoryName!, (map.get(e.subcategoryName!) || 0) + e.amount);
    });
  return map;
}, [previousMonthExpenseData, selectedCategory]);
```

4. **Remover** `average` do `CategoryData` interface e do `processExpenseData`.

5. **Atualizar o tooltip** (linhas 220-245) para:
   - View categorias: buscar `previousByCategoryMap.get(data.id)` 
   - View subcategorias: buscar `previousBySubcategoryMap.get(data.name)`
   - Calcular variação: `((atual - anterior) / anterior) * 100`
   - Verde se gastou menos, vermelho se gastou mais
   - "Mês anterior: Sem dados" se não houver valor anterior

6. **Remover** as `ReferenceLine` de média (linhas 268-278).

7. **Remover** `useEffect` dependency de `categoryAverages` (linha 156).

8. Na view de categorias, adicionar campo `id` aos dados do chart para o tooltip poder fazer lookup. O `categoryData` já tem `id`, então basta garantir que o `data` do payload contenha o `id`.

### Arquivos modificados
- `src/pages/Index.tsx`
- `src/components/GraficoDespesasInterativo.tsx`

