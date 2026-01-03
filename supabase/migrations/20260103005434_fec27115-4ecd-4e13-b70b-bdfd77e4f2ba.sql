-- Fix function search path for generate_account_number
CREATE OR REPLACE FUNCTION public.generate_account_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    new_number := '70' || LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE account_number = new_number) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_number;
END;
$$;

-- Fix function search path for generate_referral_code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    new_code := 'RDS' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_code;
END;
$$;

-- Fix function search path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;