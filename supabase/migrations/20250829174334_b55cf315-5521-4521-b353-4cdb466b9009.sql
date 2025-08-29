-- Create subcategories table
CREATE TABLE public.subcategories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category_id BIGINT NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE
);

-- Enable RLS on subcategories
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for subcategories
CREATE POLICY "Users can view their own subcategories" 
ON public.subcategories 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subcategories" 
ON public.subcategories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subcategories" 
ON public.subcategories 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subcategories" 
ON public.subcategories 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add subcategory_id column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN subcategory_id BIGINT REFERENCES public.subcategories(id) ON DELETE SET NULL;