-- Add virtual account columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS virtual_account_number TEXT,
ADD COLUMN IF NOT EXISTS virtual_account_bank TEXT,
ADD COLUMN IF NOT EXISTS virtual_account_name TEXT,
ADD COLUMN IF NOT EXISTS virtual_account_reference TEXT;