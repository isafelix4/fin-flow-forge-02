-- Add missing columns to budgets table for monthly planning
ALTER TABLE budgets ADD COLUMN subcategory_id BIGINT;
ALTER TABLE budgets ADD COLUMN plan_type TEXT CHECK (plan_type IN ('RECEITA', 'DESPESA')) NOT NULL DEFAULT 'DESPESA';

-- Update the column to use the reference month instead of budget_month for consistency
ALTER TABLE budgets RENAME COLUMN budget_month TO reference_month;