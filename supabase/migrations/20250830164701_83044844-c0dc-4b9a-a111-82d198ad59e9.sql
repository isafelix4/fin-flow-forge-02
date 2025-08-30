-- Adicionar coluna taxa_juros_mensal à tabela debts
ALTER TABLE public.debts 
ADD COLUMN taxa_juros_mensal DECIMAL(5,2);