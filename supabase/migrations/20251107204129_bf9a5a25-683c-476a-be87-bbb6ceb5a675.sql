-- Criar função RPC para cálculo de insights de categorias
create or replace function public.get_category_insights(ref_month date)
returns table (
  category_id bigint,
  category_name text,
  current_expense numeric,
  income_in_month numeric,
  prev3_avg_expense numeric,
  deviation_pct numeric,
  share_over_income numeric,
  severity text
)
language sql
stable
as $$
with m as (
  select date_trunc('month', ref_month)::date as m0
),
months_prev3 as (
  select (m.m0 - interval '1 month')::date as month_start from m
  union all select (m.m0 - interval '2 month')::date from m
  union all select (m.m0 - interval '3 month')::date from m
),

-- despesas do mês de referência por categoria (valor positivo)
cur as (
  select
    t.category_id,
    sum(abs(t.amount))::numeric as current_expense
  from transactions t
  join m on t.transaction_date >= m.m0 and t.transaction_date < (m.m0 + interval '1 month')
  where t.user_id = auth.uid()
    and (t.amount < 0 or t.type = 'Expense')
  group by t.category_id
),

-- receita total do mês de referência
income as (
  select
    coalesce(sum(case when (t.amount > 0 or t.type = 'Income') then t.amount else 0 end), 0)::numeric as income_in_month
  from transactions t
  join m on t.transaction_date >= m.m0 and t.transaction_date < (m.m0 + interval '1 month')
  where t.user_id = auth.uid()
),

-- categorias candidatas: presentes no mês atual OU nos 3 meses anteriores
cats as (
  select distinct c.id as category_id, c.name as category_name
  from categories c
  where c.user_id = auth.uid()
  union
  select distinct t.category_id, null
  from transactions t
  where t.user_id = auth.uid()
    and t.transaction_date >= (select m0 from m) - interval '3 month'
    and t.transaction_date <  (select m0 from m)
),

-- soma de cada um dos 3 meses anteriores por categoria (zero quando não houver)
prev3_by_cat as (
  select
    cats.category_id,
    mp.month_start,
    coalesce(sum(abs(t.amount)) filter (
      where t.transaction_date >= mp.month_start
        and t.transaction_date < (mp.month_start + interval '1 month')
        and (t.amount < 0 or t.type = 'Expense')
    ), 0)::numeric as month_expense
  from cats
  cross join months_prev3 mp
  left join transactions t
    on t.category_id = cats.category_id
   and t.user_id = auth.uid()
   and t.transaction_date >= (select m0 from m) - interval '3 month'
   and t.transaction_date <  (select m0 from m)
  group by cats.category_id, mp.month_start
),

prev3_avg as (
  select
    category_id,
    (sum(month_expense) / 3.0)::numeric as prev3_avg_expense
  from prev3_by_cat
  group by category_id
)

select
  coalesce(cur.category_id, p.category_id, cats.category_id) as category_id,
  (select name from categories where id = coalesce(cur.category_id, p.category_id, cats.category_id) limit 1) as category_name,
  coalesce(cur.current_expense, 0)::numeric as current_expense,
  i.income_in_month::numeric as income_in_month,
  coalesce(p.prev3_avg_expense, 0)::numeric as prev3_avg_expense,
  case when coalesce(p.prev3_avg_expense,0) = 0 then null
       else (coalesce(cur.current_expense,0) - p.prev3_avg_expense) / p.prev3_avg_expense end as deviation_pct,
  case when i.income_in_month = 0 then null
       else coalesce(cur.current_expense,0) / i.income_in_month end as share_over_income,
  case
    when i.income_in_month > 0
         and coalesce(cur.current_expense,0) / i.income_in_month > 0.20 then 'critico'
    when coalesce(p.prev3_avg_expense,0) > 0
         and (coalesce(cur.current_expense,0) - p.prev3_avg_expense) / p.prev3_avg_expense > 0.20 then 'alto'
    when coalesce(p.prev3_avg_expense,0) > 0
         and (coalesce(cur.current_expense,0) - p.prev3_avg_expense) / p.prev3_avg_expense between 0.10 and 0.20 then 'medio'
    else null
  end as severity
from prev3_avg p
full join cur on cur.category_id = p.category_id
full join cats on cats.category_id = coalesce(cur.category_id, p.category_id)
cross join income i
order by current_expense desc nulls last;
$$;

-- Criar índices para performance
create index if not exists idx_transactions_user_date on transactions (user_id, transaction_date);
create index if not exists idx_transactions_cat_date on transactions (category_id, transaction_date);