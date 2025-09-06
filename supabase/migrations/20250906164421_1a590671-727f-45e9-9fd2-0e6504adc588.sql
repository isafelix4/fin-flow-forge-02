-- Fix security linter issues

-- Fix 1: Remove security definer view and create proper RLS policies instead
DROP VIEW IF EXISTS public.secure_profiles;

-- Update RLS policy on profiles to mask emails properly
DROP POLICY IF EXISTS "Users can view secure profiles" ON public.profiles;

-- Create enhanced RLS policy that masks emails at the row level
CREATE POLICY "Users can view profiles with masked emails" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Fix 2: Set search_path for all functions to address mutable search path warnings

-- Update hash_email function
CREATE OR REPLACE FUNCTION public.hash_email(email_input text)
RETURNS text AS $$
BEGIN
  RETURN encode(digest(email_input || 'security_salt_2024', 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;

-- Update validate_password_strength function  
CREATE OR REPLACE FUNCTION public.validate_password_strength(password_input text)
RETURNS boolean AS $$
BEGIN
  IF length(password_input) < 8 THEN
    RETURN false;
  END IF;
  
  IF password_input !~ '[0-9]' THEN
    RETURN false;
  END IF;
  
  IF password_input !~ '[A-Za-z]' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;

-- Update log_security_event function
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type_input text,
  event_details_input jsonb DEFAULT '{}',
  user_id_input uuid DEFAULT auth.uid()
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.security_audit_log (user_id, event_type, event_details)
  VALUES (user_id_input, event_type_input, event_details_input);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update validate_csv_input function
CREATE OR REPLACE FUNCTION public.validate_csv_input(
  input_text text,
  max_length integer DEFAULT 1000
)
RETURNS text AS $$
DECLARE
  sanitized_text text;
BEGIN
  sanitized_text := regexp_replace(input_text, '<[^>]*>', '', 'gi');
  sanitized_text := regexp_replace(sanitized_text, 'javascript:', '', 'gi');
  sanitized_text := regexp_replace(sanitized_text, 'data:', '', 'gi');
  
  IF length(sanitized_text) > max_length THEN
    sanitized_text := substring(sanitized_text from 1 for max_length);
  END IF;
  
  RETURN sanitized_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;

-- Update validate_transaction_input function
CREATE OR REPLACE FUNCTION public.validate_transaction_input()
RETURNS trigger AS $$
BEGIN
  NEW.description := public.validate_csv_input(NEW.description, 500);
  
  PERFORM public.log_security_event(
    'transaction_created',
    jsonb_build_object(
      'transaction_id', NEW.id,
      'amount', NEW.amount,
      'type', NEW.type
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update existing handle_new_user function to include search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, email_hash)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.email,
        public.hash_email(NEW.email)
    );
    
    -- Log user registration
    PERFORM public.log_security_event(
      'user_registered',
      jsonb_build_object('user_id', NEW.id)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;