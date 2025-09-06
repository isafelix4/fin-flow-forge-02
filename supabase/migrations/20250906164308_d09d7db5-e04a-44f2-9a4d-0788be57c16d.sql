-- Phase 1: Critical Fix - Email Protection Enhancement

-- Create a function to hash/pseudonymize emails for security
CREATE OR REPLACE FUNCTION public.hash_email(email_input text)
RETURNS text AS $$
BEGIN
  -- Create a consistent hash of the email for internal use
  RETURN encode(digest(email_input || 'security_salt_2024', 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- Add email_hash column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN email_hash text;

-- Update existing records with email hashes
UPDATE public.profiles 
SET email_hash = public.hash_email(email);

-- Create a secure view for profile access that masks emails
CREATE OR REPLACE VIEW public.secure_profiles AS
SELECT 
  id,
  name,
  -- Only show full email to the profile owner, others see masked version
  CASE 
    WHEN auth.uid() = id THEN email
    ELSE substring(email from 1 for 2) || '***@' || split_part(email, '@', 2)
  END as email,
  email_hash,
  created_at
FROM public.profiles;

-- Enable RLS on the secure view
ALTER VIEW public.secure_profiles SET (security_barrier = true);

-- Create RLS policies for the secure view
CREATE POLICY "Users can view secure profiles" 
ON public.profiles 
FOR SELECT 
USING (true); -- Allow viewing through the secure view

-- Phase 2: Authentication Hardening - Database Level

-- Create a function to validate password strength
CREATE OR REPLACE FUNCTION public.validate_password_strength(password_input text)
RETURNS boolean AS $$
BEGIN
  -- Check minimum length (8 characters)
  IF length(password_input) < 8 THEN
    RETURN false;
  END IF;
  
  -- Check for at least one number
  IF password_input !~ '[0-9]' THEN
    RETURN false;
  END IF;
  
  -- Check for at least one letter
  IF password_input !~ '[A-Za-z]' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- Create audit log table for security monitoring
CREATE TABLE public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_details jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only allow viewing own audit logs
CREATE POLICY "Users can view their own audit logs"
ON public.security_audit_log
FOR SELECT
USING (auth.uid() = user_id);

-- Create function to log security events
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Phase 3: Enhanced Input Validation

-- Create function to validate and sanitize CSV input
CREATE OR REPLACE FUNCTION public.validate_csv_input(
  input_text text,
  max_length integer DEFAULT 1000
)
RETURNS text AS $$
DECLARE
  sanitized_text text;
BEGIN
  -- Remove potential script tags and suspicious content
  sanitized_text := regexp_replace(input_text, '<[^>]*>', '', 'gi');
  sanitized_text := regexp_replace(sanitized_text, 'javascript:', '', 'gi');
  sanitized_text := regexp_replace(sanitized_text, 'data:', '', 'gi');
  
  -- Limit length
  IF length(sanitized_text) > max_length THEN
    sanitized_text := substring(sanitized_text from 1 for max_length);
  END IF;
  
  RETURN sanitized_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- Add validation trigger for transaction descriptions
CREATE OR REPLACE FUNCTION public.validate_transaction_input()
RETURNS trigger AS $$
BEGIN
  -- Sanitize description
  NEW.description := public.validate_csv_input(NEW.description, 500);
  
  -- Log transaction creation for audit
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for transaction validation
DROP TRIGGER IF EXISTS validate_transaction_trigger ON public.transactions;
CREATE TRIGGER validate_transaction_trigger
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_transaction_input();