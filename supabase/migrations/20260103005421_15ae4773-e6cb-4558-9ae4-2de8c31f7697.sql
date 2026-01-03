-- Create enum for transaction types
CREATE TYPE public.transaction_type AS ENUM ('credit', 'debit');

-- Create enum for transaction category
CREATE TYPE public.transaction_category AS ENUM ('deposit', 'airtime', 'data', 'electricity', 'tv', 'transfer', 'referral_bonus');

-- Create enum for transaction status
CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'failed');

-- Create enum for referral status
CREATE TYPE public.referral_status AS ENUM ('pending', 'completed', 'bonus_paid');

-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  account_number TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Create wallets table
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type public.transaction_type NOT NULL,
  category public.transaction_category NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT NOT NULL,
  status public.transaction_status DEFAULT 'pending' NOT NULL,
  reference TEXT UNIQUE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create referrals table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  referee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status public.referral_status DEFAULT 'pending' NOT NULL,
  referrer_bonus DECIMAL(15, 2) DEFAULT 200.00,
  referee_bonus DECIMAL(15, 2) DEFAULT 100.00,
  bonus_paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (referrer_id, referee_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to generate unique account number
CREATE OR REPLACE FUNCTION public.generate_account_number()
RETURNS TEXT
LANGUAGE plpgsql
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

-- Create function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
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

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referred_by_id UUID;
  referral_code_input TEXT;
BEGIN
  referral_code_input := NEW.raw_user_meta_data ->> 'referral_code';
  
  -- Find referrer if referral code was provided
  IF referral_code_input IS NOT NULL AND referral_code_input != '' THEN
    SELECT id INTO referred_by_id FROM public.profiles WHERE referral_code = referral_code_input;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, phone, email, account_number, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    NEW.email,
    public.generate_account_number(),
    public.generate_referral_code(),
    referred_by_id
  );

  -- Create wallet
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0.00);

  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  -- Create referral record if referred
  IF referred_by_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referee_id)
    VALUES (referred_by_id, (SELECT id FROM public.profiles WHERE user_id = NEW.id));
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Profiles are insertable during registration"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for wallets
CREATE POLICY "Users can view their own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet"
  ON public.wallets FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for referrals
CREATE POLICY "Users can view referrals they are part of"
  ON public.referrals FOR SELECT
  USING (
    referrer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR referee_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Allow public read of profiles by referral_code for signup lookup
CREATE POLICY "Anyone can lookup profile by referral code"
  ON public.profiles FOR SELECT
  USING (true);