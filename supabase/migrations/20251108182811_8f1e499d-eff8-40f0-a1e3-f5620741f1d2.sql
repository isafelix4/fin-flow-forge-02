-- Corrigir função RPC para usar reference_month ao invés de transaction_date
-- e garantir que não há duplicidade de categorias

DROP FUNCTION IF EXISTS public.get_category_insights(date);

CREATE OR REPLACE FUNCTION public.get_category_insights(ref_month date)
RETURNS TABLE (
  category_id bigint,
  category_name text,
  current_expense numeric,
  income_in_month numeric,
  prev3_avg_expense numeric,
  deviation_pct numeric,
  share_over_income numeric,
  severity text
)
LANGUAGE sql
STABLE
AS $$
WITH m AS (
  -- Mês de referência (primeiro dia do mês)
  SELECT date_trunc('month', ref_month)::date AS m0
),
months_prev3 AS (
  -- 3 meses anteriores ao mês de referência
  SELECT (m.m0 - interval '1 month')::date AS month_start FROM m
  UNION ALL SELECT (m.m0 - interval '2 month')::date FROM m
  UNION ALL SELECT (m.m0 - interval '3 month')::date FROM m
),

-- Despesas do mês de referência por categoria (valor absoluto)
cur AS (
  SELECT
    t.category_id,
    SUM(ABS(t.amount))::numeric AS current_expense
  FROM transactions t
  CROSS JOIN m
  WHERE t.user_id = auth.uid()
    AND t.reference_month = m.m0
    AND (t.amount < 0 OR t.type = 'Expense')
    AND t.category_id IS NOT NULL
  GROUP BY t.category_id
),

-- Receita total do mês de referência
income AS (
  SELECT
    COALESCE(SUM(CASE WHEN (t.amount > 0 OR t.type = 'Income') THEN t.amount ELSE 0 END), 0)::numeric AS income_in_month
  FROM transactions t
  CROSS JOIN m
  WHERE t.user_id = auth.uid()
    AND t.reference_month = m.m0
),

-- Categorias do usuário (apenas categorias Standard, excluindo Debt e Investment)
cats AS (
  SELECT DISTINCT c.id AS category_id, c.name AS category_name
  FROM categories c
  WHERE c.user_id = auth.uid()
    AND c.type = 'Standard'
),

-- Soma de cada um dos 3 meses anteriores por categoria
prev3_by_cat AS (
  SELECT
    cats.category_id,
    mp.month_start,
    COALESCE(SUM(ABS(t.amount)) FILTER (
      WHERE t.reference_month = mp.month_start
        AND (t.amount < 0 OR t.type = 'Expense')
    ), 0)::numeric AS month_expense
  FROM cats
  CROSS JOIN months_prev3 mp
  LEFT JOIN transactions t
    ON t.category_id = cats.category_id
    AND t.user_id = auth.uid()
  GROUP BY cats.category_id, mp.month_start
),

-- Média dos 3 meses anteriores
prev3_avg AS (
  SELECT
    category_id,
    (SUM(month_expense) / 3.0)::numeric AS prev3_avg_expense
  FROM prev3_by_cat
  GROUP BY category_id
)

-- Query final com apenas categorias que têm severity não-nula
SELECT DISTINCT ON (coalesce(cur.category_id, p.category_id))
  COALESCE(cur.category_id, p.category_id) AS category_id,
  cats.category_name,
  COALESCE(cur.current_expense, 0)::numeric AS current_expense,
  i.income_in_month::numeric AS income_in_month,
  COALESCE(p.prev3_avg_expense, 0)::numeric AS prev3_avg_expense,
  CASE WHEN COALESCE(p.prev3_avg_expense, 0) = 0 THEN NULL
       ELSE (COALESCE(cur.current_expense, 0) - p.prev3_avg_expense) / p.prev3_avg_expense 
  END AS deviation_pct,
  CASE WHEN i.income_in_month = 0 THEN NULL
       ELSE COALESCE(cur.current_expense, 0) / i.income_in_month 
  END AS share_over_income,
  CASE
    -- Crítico: despesa > 20% da receita do mês
    WHEN i.income_in_month > 0
         AND COALESCE(cur.current_expense, 0) / i.income_in_month > 0.20 THEN 'critico'
    -- Alto: > 20% acima da média dos 3 meses anteriores
    WHEN COALESCE(p.prev3_avg_expense, 0) > 0
         AND (COALESCE(cur.current_expense, 0) - p.prev3_avg_expense) / p.prev3_avg_expense > 0.20 THEN 'alto'
    -- Médio: entre 10% e 20% acima da média
    WHEN COALESCE(p.prev3_avg_expense, 0) > 0
         AND (COALESCE(cur.current_expense, 0) - p.prev3_avg_expense) / p.prev3_avg_expense BETWEEN 0.10 AND 0.20 THEN 'medio'
    ELSE NULL
  END AS severity
FROM prev3_avg p
FULL JOIN cur ON cur.category_id = p.category_id
INNER JOIN cats ON cats.category_id = COALESCE(cur.category_id, p.category_id)
CROSS JOIN income i
WHERE COALESCE(cur.category_id, p.category_id) IS NOT NULL
ORDER BY COALESCE(cur.category_id, p.category_id), current_expense DESC NULLS LAST;
$$;

-- Atualizar índices para usar reference_month
DROP INDEX IF EXISTS idx_transactions_user_date;
DROP INDEX IF EXISTS idx_transactions_cat_date;

CREATE INDEX IF NOT EXISTS idx_transactions_user_ref_month 
  ON transactions (user_id, reference_month);
  
CREATE INDEX IF NOT EXISTS idx_transactions_cat_ref_month 
  ON transactions (category_id, reference_month);

-- Criar índice composto para otimizar a query do RPC
CREATE INDEX IF NOT EXISTS idx_transactions_insights 
  ON transactions (user_id, reference_month, category_id, type, amount) 
  WHERE category_id IS NOT NULL;