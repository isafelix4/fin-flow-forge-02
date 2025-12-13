-- Adiciona constraint única para permitir upsert de budgets
ALTER TABLE public.budgets 
ADD CONSTRAINT unique_budget_entry 
UNIQUE (user_id, reference_month, category_id, subcategory_id);