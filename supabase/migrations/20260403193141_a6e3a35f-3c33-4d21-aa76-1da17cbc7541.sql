CREATE OR REPLACE FUNCTION public.get_category_insights(ref_month date)
 RETURNS TABLE(category_id bigint, category_name text, current_expense numeric, income_in_month numeric, prev3_avg_expense numeric, deviation_pct numeric, share_over_income numeric, severity text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $$
WITH m AS (
  SELECT date_trunc('month', ref_month)::date AS m0
),
months_prev3 AS (
  SELECT (m.m0 - interval '1 month')::date AS month_start FROM m
  UNION ALL SELECT (m.m0 - interval '2 month')::date FROM m
  UNION ALL SELECT (m.m0 - interval '3 month')::date FROM m
),

-- Categorias do usuário (apenas Standard, excluindo Debt, Investment e Transfer)
cats AS (
  SELECT DISTINCT c.id AS category_id, c.name AS category_name
  FROM categories c
  WHERE c.user_id = auth.uid()
    AND c.type = 'Standard'
),

-- Despesas do mês de referência por categoria (apenas categorias Standard)
cur AS (
  SELECT
    t.category_id,
    SUM(ABS(t.amount))::numeric AS current_expense
  FROM transactions t
  CROSS JOIN m
  INNER JOIN cats ON cats.category_id = t.category_id
  WHERE t.user_id = auth.uid()
    AND t.reference_month = m.m0
    AND (t.amount < 0 OR t.type = 'Expense')
    AND t.category_id IS NOT NULL
  GROUP BY t.category_id
),

-- Receita total do mês de referência (excluindo categorias Transfer)
income AS (
  SELECT
    COALESCE(SUM(CASE WHEN (t.amount > 0 OR t.type = 'Income') THEN t.amount ELSE 0 END), 0)::numeric AS income_in_month
  FROM transactions t
  CROSS JOIN m
  LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = auth.uid()
  WHERE t.user_id = auth.uid()
    AND t.reference_month = m.m0
    AND (c.type IS NULL OR c.type != 'Transfer')
),

-- Soma de cada um dos 3 meses anteriores por categoria (apenas Standard)
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
    WHEN i.income_in_month > 0
         AND COALESCE(cur.current_expense, 0) / i.income_in_month > 0.20 THEN 'critico'
    WHEN COALESCE(p.prev3_avg_expense, 0) > 0
         AND (COALESCE(cur.current_expense, 0) - p.prev3_avg_expense) / p.prev3_avg_expense > 0.20 THEN 'alto'
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