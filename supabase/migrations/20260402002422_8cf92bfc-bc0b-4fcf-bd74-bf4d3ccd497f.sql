
-- 1. Fix log_security_event: remove user_id_input parameter to prevent impersonation
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type_input text,
  event_details_input jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit_log (user_id, event_type, event_details)
  VALUES (auth.uid(), event_type_input, event_details_input);
END;
$$;

-- 2. Add restrictive RLS policies on security_audit_log (deny direct INSERT/UPDATE/DELETE by authenticated users)
CREATE POLICY "Deny authenticated insert to audit logs"
  ON public.security_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny authenticated update to audit logs"
  ON public.security_audit_log
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Deny authenticated delete from audit logs"
  ON public.security_audit_log
  FOR DELETE
  TO authenticated
  USING (false);

-- 3. Add DELETE policy for profiles table
CREATE POLICY "Authenticated users can delete their own profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- 4. Fix get_category_insights search_path
ALTER FUNCTION public.get_category_insights(date) SET search_path = public;
