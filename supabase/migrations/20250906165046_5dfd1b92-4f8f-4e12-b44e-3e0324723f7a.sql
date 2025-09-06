-- Fix Security Definer View Issue

-- Drop the problematic view and recreate it properly
DROP VIEW IF EXISTS public.secure_public_profiles;

-- Instead of a view, create a proper function for secure profile access
CREATE OR REPLACE FUNCTION public.get_secure_public_profiles()
RETURNS TABLE (
  id uuid,
  name text,
  email_hash text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.email_hash, p.created_at
  FROM public.profiles p;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Also remove the problematic RLS policy that was added for the view
DROP POLICY IF EXISTS "Secure public profiles access" ON public.profiles;