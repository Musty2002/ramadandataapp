-- Create electricity providers table
CREATE TABLE public.electricity_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  service_id integer NOT NULL,
  discount_percent numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for electricity_providers
ALTER TABLE public.electricity_providers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active electricity providers
CREATE POLICY "Anyone can view active electricity providers"
ON public.electricity_providers
FOR SELECT
USING (is_active = true);

-- Insert electricity providers with iSquare rates
INSERT INTO public.electricity_providers (name, code, service_id, discount_percent) VALUES
('AEDC - Abuja Electricity', 'aedc', 16, 0.4),
('EKEDC - Eko Electricity', 'ekedc', 17, 0.5),
('IBEDC - Ibadan Electricity', 'ibedc', 18, 0.5),
('IKEDC - Ikeja Electricity', 'ikedc', 19, 0.5),
('JED - Jos Electricity', 'jed', 20, 0.5),
('KAEDCO - Kaduna Electricity', 'kaedco', 21, 0.5),
('KEDCO - Kano Electricity', 'kedco', 22, 0.5),
('PHED - Port Harcourt Electricity', 'phed', 23, 0.2),
('EEDC - Enugu Electricity', 'eedc', 26, 0.5),
('BEDC - Benin Electricity', 'bedc', 27, 0.3);

-- Create cable TV providers table
CREATE TABLE public.cable_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  service_id integer NOT NULL,
  discount_percent numeric NOT NULL DEFAULT 1.0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for cable_providers
ALTER TABLE public.cable_providers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active cable providers
CREATE POLICY "Anyone can view active cable providers"
ON public.cable_providers
FOR SELECT
USING (is_active = true);

-- Insert cable providers
INSERT INTO public.cable_providers (name, code, service_id, discount_percent) VALUES
('GOtv', 'gotv', 1, 1.0),
('StarTimes', 'startimes', 2, 1.0),
('DSTV', 'dstv', 3, 1.0);

-- Create cable TV bouquets table
CREATE TABLE public.cable_bouquets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_code text NOT NULL,
  name text NOT NULL,
  plan_id integer NOT NULL,
  price numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for cable_bouquets
ALTER TABLE public.cable_bouquets ENABLE ROW LEVEL SECURITY;

-- Anyone can view active cable bouquets
CREATE POLICY "Anyone can view active cable bouquets"
ON public.cable_bouquets
FOR SELECT
USING (is_active = true);

-- Insert GOtv bouquets
INSERT INTO public.cable_bouquets (provider_code, name, plan_id, price) VALUES
('gotv', 'GOtv Max', 1, 8500),
('gotv', 'GOtv Jolli', 2, 5800),
('gotv', 'GOtv Jinja', 3, 3900),
('gotv', 'GOtv Smallie Monthly', 4, 1900),
('gotv', 'GOtv Smallie Quarterly', 5, 5100),
('gotv', 'GOtv Smallie Yearly', 6, 15000),
('gotv', 'GOtv Supa Monthly', 7, 11400),
('gotv', 'GOtv Supa Plus', 8, 16800);

-- Insert StarTimes bouquets
INSERT INTO public.cable_bouquets (provider_code, name, plan_id, price) VALUES
('startimes', 'Nova (Dish) 1 Month', 9, 2100),
('startimes', 'Basic (Antenna) 1 Month', 10, 4000),
('startimes', 'Smart/Basic (Dish) 1 Month', 11, 5100),
('startimes', 'Classic (Antenna) 1 Month', 12, 6000),
('startimes', 'Super (Dish) 1 Month', 13, 9800),
('startimes', 'Nova (Antenna) 1 Week', 14, 700),
('startimes', 'Basic (Antenna) 1 Week', 15, 1400),
('startimes', 'Smart (Dish) 1 Week', 16, 1550),
('startimes', 'Classic (Antenna) 1 Week', 17, 2000),
('startimes', 'Super (Dish) 1 Week', 18, 3300);

-- Insert DSTV bouquets
INSERT INTO public.cable_bouquets (provider_code, name, plan_id, price) VALUES
('dstv', 'DStv Padi', 32, 4400),
('dstv', 'DStv Yanga', 33, 6000),
('dstv', 'DStv Confam', 34, 11000),
('dstv', 'DStv Compact', 35, 19000),
('dstv', 'DStv Premium', 36, 44500),
('dstv', 'DStv Asia', 37, 14900),
('dstv', 'DStv Compact Plus', 38, 30000),
('dstv', 'DStv Premium French', 39, 69000);

-- Create exam pins table
CREATE TABLE public.exam_pins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  service_id integer NOT NULL,
  price numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for exam_pins
ALTER TABLE public.exam_pins ENABLE ROW LEVEL SECURITY;

-- Anyone can view active exam pins
CREATE POLICY "Anyone can view active exam pins"
ON public.exam_pins
FOR SELECT
USING (is_active = true);

-- Insert exam pins with iSquare rates
INSERT INTO public.exam_pins (name, code, service_id, price) VALUES
('WAEC Result Checker', 'waec', 11, 3400),
('NECO Result Checker', 'neco', 12, 1150),
('NABTEB Result Checker', 'nabteb', 25, 820);

-- Add new transaction categories to enum
ALTER TYPE transaction_category ADD VALUE IF NOT EXISTS 'electricity';
ALTER TYPE transaction_category ADD VALUE IF NOT EXISTS 'cable';
ALTER TYPE transaction_category ADD VALUE IF NOT EXISTS 'exam';