-- Add rentabilidade column to investments table
ALTER TABLE public.investments 
ADD COLUMN rentabilidade DECIMAL(5, 2);