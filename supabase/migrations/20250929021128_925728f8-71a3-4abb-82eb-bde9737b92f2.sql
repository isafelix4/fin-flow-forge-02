-- Fix security vulnerabilities by strengthening RLS policies

-- First, let's remove any potentially permissive policies and add strict ones
-- for the profiles table to prevent email address theft

-- Drop existing duplicate policies on profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own complete profile" ON public.profiles;

-- Create a single, strict policy for profile access that explicitly denies anonymous users
CREATE POLICY "Users can only access their own profile data" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Ensure profiles table INSERT/UPDATE policies are also restricted to authenticated users
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Authenticated users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Add explicit denial policy for anonymous users on profiles
CREATE POLICY "Deny anonymous access to profiles" 
ON public.profiles 
FOR ALL 
TO anon 
USING (false);

-- Fix security audit log access - restrict to user's own logs only and deny anonymous access
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.security_audit_log;

CREATE POLICY "Users can only view their own audit logs" 
ON public.security_audit_log 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Deny anonymous access to security audit logs
CREATE POLICY "Deny anonymous access to audit logs" 
ON public.security_audit_log 
FOR ALL 
TO anon 
USING (false);

-- Strengthen financial tables security by explicitly denying anonymous access
-- This adds an extra layer of security beyond existing RLS policies

-- Accounts table
CREATE POLICY "Deny anonymous access to accounts" 
ON public.accounts 
FOR ALL 
TO anon 
USING (false);

-- Transactions table  
CREATE POLICY "Deny anonymous access to transactions" 
ON public.transactions 
FOR ALL 
TO anon 
USING (false);

-- Budgets table
CREATE POLICY "Deny anonymous access to budgets" 
ON public.budgets 
FOR ALL 
TO anon 
USING (false);

-- Debts table
CREATE POLICY "Deny anonymous access to debts" 
ON public.debts 
FOR ALL 
TO anon 
USING (false);

-- Investments table
CREATE POLICY "Deny anonymous access to investments" 
ON public.investments 
FOR ALL 
TO anon 
USING (false);

-- Categories table
CREATE POLICY "Deny anonymous access to categories" 
ON public.categories 
FOR ALL 
TO anon 
USING (false);

-- Subcategories table
CREATE POLICY "Deny anonymous access to subcategories" 
ON public.subcategories 
FOR ALL 
TO anon 
USING (false);