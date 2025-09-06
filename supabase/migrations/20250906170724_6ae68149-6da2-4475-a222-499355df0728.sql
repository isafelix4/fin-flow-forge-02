-- Migration to fix user profile creation error
-- This migration removes a constraint incorrectly applied to the 'profiles' table.
-- The problematic constraint was a foreign key on a non-existent 'user_id' column,
-- while the correct foreign key is the 'id' column itself, referencing 'auth.users(id)'.
-- Removing this constraint will allow the 'handle_new_user' trigger to function correctly.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;