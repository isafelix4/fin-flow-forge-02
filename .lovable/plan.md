
## Plano de correção

### Diagnóstico
O problema principal não está no tooltip em si, nem no join de categorias/subcategorias: ele está na geração dos meses anteriores em `src/pages/Index.tsx`.

Hoje o código faz:
```ts
const referenceDate = new Date(referenceMonth);
const previousMonths = [
  format(subMonths(referenceDate, 1), 'yyyy-MM-dd'),
  ...
];
```

Como `referenceMonth` é uma string ISO (`yyyy-MM-dd`), `new Date('2026-03-01')` sofre conversão de timezone. Pelos logs, isso já está acontecendo:

```text
Mês de referência: 2026-03-01
3 meses anteriores: ["2026-01-28", "2025-12-28", "2025-11-28"]
```

Ou seja:
- o sistema deveria buscar `2026-02-01`, `2026-01-01`, `2025-12-01`
- mas está buscando datas inválidas para `reference_month`

Resultado:
- a query histórica `.in('reference_month', previousMonths)` não encontra linhas
- `historicalTransactions` fica vazio
- `previousMonthExpenseData` fica vazio
- o tooltip de categorias e subcategorias sempre cai em “Mês anterior: Sem dados”

As subcategorias não têm um bug separado: elas apenas herdam esse array vazio.

### Melhor forma de corrigir
A correção mais eficiente é parar de usar `Date`/UTC para lógica de `reference_month` e tratar mês de referência como string de domínio (`yyyy-MM-01`).

### Alterações propostas

#### 1. Corrigir a geração dos meses anteriores em `src/pages/Index.tsx`
Substituir a lógica baseada em:
- `new Date(referenceMonth)`
- `subMonths(referenceDate, ...)`
- `format(..., 'yyyy-MM-dd')`

por uma lógica segura para `reference_month`, por exemplo:
- helper string-based para deslocar mês (`yyyy-MM-01` -> mês anterior)
- ou parsing seguro sem UTC implícito

Objetivo: garantir que o array histórico fique assim:
```text
['2026-02-01', '2026-01-01', '2025-12-01']
```

#### 2. Centralizar helpers de mês de referência
Criar um pequeno utilitário reutilizável para:
- normalizar `reference_month`
- obter meses anteriores
- evitar repetição de lógica vulnerável a timezone

Exemplo de responsabilidade desse helper:
- `shiftReferenceMonth(referenceMonth, -1)`
- `getPreviousReferenceMonths(referenceMonth, 3)`

Isso reduz o risco de o mesmo bug voltar em outros pontos do app.

#### 3. Ajustar `src/components/ui/month-year-picker.tsx`
Esse componente ainda usa padrões inseguros para mês de referência:
- `new Date(value).getFullYear()`
- `new Date(value).getMonth()`
- `new Date(year, month, 1).toISOString().slice(0, 7) + '-01'`

Esses trechos também podem gerar deslocamentos de mês dependendo do fuso.

Plano:
- extrair ano e mês diretamente da string `yyyy-MM-dd`
- montar o valor selecionado manualmente como string `yyyy-MM-01`
- manter parsing com horário neutro apenas para exibição formatada, se necessário

Isso evita regressões visuais e garante consistência com a Home.

### Arquivos envolvidos
- `src/pages/Index.tsx` — corrigir cálculo de `previousMonths` e manter `previousMonthExpenseData` consistente
- `src/components/ui/month-year-picker.tsx` — eliminar parsing/serialização com risco de timezone
- opcional: novo utilitário compartilhado, por exemplo `src/lib/referenceMonth.ts`

### Validação após a correção
Validar estes cenários:
1. Selecionando `2026-03-01`, os meses anteriores calculados devem ser:
   - `2026-02-01`
   - `2026-01-01`
   - `2025-12-01`
2. `historicalTransactions.length` deve voltar a ter dados
3. `previousMonthExpenseData.length` deve ser maior que zero quando houver despesas no mês anterior
4. Tooltip de categoria deve mostrar:
   - mês atual
   - % de variação
   - valor absoluto do mês anterior
5. Tooltip de subcategoria deve mostrar a mesma lógica corretamente

### Resultado esperado
Depois da correção:
- categorias e subcategorias passam a encontrar o mês anterior real
- o tooltip deixa de mostrar “Sem dados” indevidamente
- a lógica de `reference_month` fica estável e independente de timezone
- o app reduz o risco de bugs semelhantes em filtros mensais e comparações históricas futuras

### Observação sobre banco
Nenhuma alteração em tables ou migrations é necessária. O problema é de frontend/data handling, não de schema.
