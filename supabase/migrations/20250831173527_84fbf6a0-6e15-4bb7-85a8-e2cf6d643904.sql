-- 1. Remover a restrição antiga que não considera subcategorias
ALTER TABLE public.budgets 
DROP CONSTRAINT IF EXISTS unique_user_category_month;

-- 2. Adicionar uma nova restrição única que inclui subcategorias.
-- Esta restrição garante que um usuário não possa ter entradas duplicadas
-- para a mesma categoria/subcategoria no mesmo mês.
ALTER TABLE public.budgets 
ADD CONSTRAINT budgets_user_month_category_subcategory_unique 
UNIQUE (user_id, reference_month, category_id, subcategory_id, plan_type);