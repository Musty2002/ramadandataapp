-- Create api_providers table
CREATE TABLE IF NOT EXISTS public.api_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  base_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create data_plans table with support for both providers
CREATE TABLE IF NOT EXISTS public.data_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  network TEXT NOT NULL,
  service_id INTEGER,
  plan_id INTEGER,
  product_id TEXT,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  data_amount TEXT,
  validity TEXT,
  api_price NUMERIC NOT NULL,
  selling_price NUMERIC NOT NULL,
  category TEXT NOT NULL DEFAULT 'sme',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create airtime_plans table for discount rates per provider
CREATE TABLE IF NOT EXISTS public.airtime_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  network TEXT NOT NULL,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  min_amount NUMERIC NOT NULL DEFAULT 50,
  max_amount NUMERIC NOT NULL DEFAULT 50000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airtime_plans ENABLE ROW LEVEL SECURITY;

-- Public read policies for all
CREATE POLICY "Anyone can view active providers" ON public.api_providers FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view active data plans" ON public.data_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view active airtime plans" ON public.airtime_plans FOR SELECT USING (is_active = true);

-- Create index for faster queries
CREATE INDEX idx_data_plans_network_category ON public.data_plans(network, category, selling_price);
CREATE INDEX idx_airtime_plans_network ON public.airtime_plans(network, provider);

-- Insert API providers
INSERT INTO public.api_providers (name, base_url, priority) VALUES
  ('isquare', 'https://isquare.ng/api/v1', 1),
  ('rgc', 'https://rgc.ng/api/v1', 2);

-- Insert iSquare MTN Data Plans
INSERT INTO public.data_plans (provider, network, service_id, plan_id, name, display_name, data_amount, validity, api_price, selling_price, category) VALUES
  ('isquare', 'mtn', 27, 1, '500MB', 'MTN 500MB SME', '500MB', '30 Days', 115, 125, 'sme'),
  ('isquare', 'mtn', 27, 2, '1GB', 'MTN 1GB SME', '1GB', '30 Days', 210, 230, 'sme'),
  ('isquare', 'mtn', 27, 3, '2GB', 'MTN 2GB SME', '2GB', '30 Days', 420, 460, 'sme'),
  ('isquare', 'mtn', 27, 4, '3GB', 'MTN 3GB SME', '3GB', '30 Days', 630, 690, 'sme'),
  ('isquare', 'mtn', 27, 5, '5GB', 'MTN 5GB SME', '5GB', '30 Days', 1050, 1150, 'sme'),
  ('isquare', 'mtn', 27, 6, '10GB', 'MTN 10GB SME', '10GB', '30 Days', 2100, 2300, 'sme'),
  ('isquare', 'mtn', 28, 1, '500MB', 'MTN 500MB Corporate', '500MB', '30 Days', 105, 115, 'corporate'),
  ('isquare', 'mtn', 28, 2, '1GB', 'MTN 1GB Corporate', '1GB', '30 Days', 195, 215, 'corporate'),
  ('isquare', 'mtn', 28, 3, '2GB', 'MTN 2GB Corporate', '2GB', '30 Days', 390, 430, 'corporate'),
  ('isquare', 'mtn', 28, 4, '3GB', 'MTN 3GB Corporate', '3GB', '30 Days', 585, 645, 'corporate'),
  ('isquare', 'mtn', 28, 5, '5GB', 'MTN 5GB Corporate', '5GB', '30 Days', 975, 1070, 'corporate'),
  ('isquare', 'mtn', 28, 6, '10GB', 'MTN 10GB Corporate', '10GB', '30 Days', 1950, 2140, 'corporate');

-- Insert RGC MTN Data Plans (competitor pricing)
INSERT INTO public.data_plans (provider, network, product_id, name, display_name, data_amount, validity, api_price, selling_price, category) VALUES
  ('rgc', 'mtn', 'mtn-sme-500mb', '500MB', 'MTN 500MB SME', '500MB', '30 Days', 120, 130, 'sme'),
  ('rgc', 'mtn', 'mtn-sme-1gb', '1GB', 'MTN 1GB SME', '1GB', '30 Days', 220, 240, 'sme'),
  ('rgc', 'mtn', 'mtn-sme-2gb', '2GB', 'MTN 2GB SME', '2GB', '30 Days', 430, 470, 'sme'),
  ('rgc', 'mtn', 'mtn-corp-500mb', '500MB', 'MTN 500MB Corporate', '500MB', '30 Days', 110, 120, 'corporate'),
  ('rgc', 'mtn', 'mtn-corp-1gb', '1GB', 'MTN 1GB Corporate', '1GB', '30 Days', 200, 220, 'corporate'),
  ('rgc', 'mtn', 'mtn-corp-2gb', '2GB', 'MTN 2GB Corporate', '2GB', '30 Days', 400, 440, 'corporate');

-- Insert Airtel Data Plans
INSERT INTO public.data_plans (provider, network, service_id, plan_id, name, display_name, data_amount, validity, api_price, selling_price, category) VALUES
  ('isquare', 'airtel', 29, 1, '500MB', 'Airtel 500MB', '500MB', '30 Days', 110, 120, 'sme'),
  ('isquare', 'airtel', 29, 2, '1GB', 'Airtel 1GB', '1GB', '30 Days', 210, 230, 'sme'),
  ('isquare', 'airtel', 29, 3, '2GB', 'Airtel 2GB', '2GB', '30 Days', 420, 460, 'sme'),
  ('isquare', 'airtel', 29, 4, '5GB', 'Airtel 5GB', '5GB', '30 Days', 1050, 1150, 'sme'),
  ('isquare', 'airtel', 30, 1, '500MB', 'Airtel 500MB Corporate', '500MB', '30 Days', 100, 110, 'corporate'),
  ('isquare', 'airtel', 30, 2, '1GB', 'Airtel 1GB Corporate', '1GB', '30 Days', 190, 210, 'corporate'),
  ('isquare', 'airtel', 30, 3, '2GB', 'Airtel 2GB Corporate', '2GB', '30 Days', 380, 420, 'corporate');

-- Insert Glo Data Plans
INSERT INTO public.data_plans (provider, network, service_id, plan_id, name, display_name, data_amount, validity, api_price, selling_price, category) VALUES
  ('isquare', 'glo', 31, 1, '500MB', 'Glo 500MB', '500MB', '30 Days', 100, 110, 'sme'),
  ('isquare', 'glo', 31, 2, '1GB', 'Glo 1GB', '1GB', '30 Days', 190, 210, 'sme'),
  ('isquare', 'glo', 31, 3, '2GB', 'Glo 2GB', '2GB', '30 Days', 380, 420, 'sme'),
  ('isquare', 'glo', 31, 4, '5GB', 'Glo 5GB', '5GB', '30 Days', 950, 1050, 'sme'),
  ('isquare', 'glo', 32, 1, '1GB', 'Glo 1GB Corporate', '1GB', '30 Days', 180, 200, 'corporate'),
  ('isquare', 'glo', 32, 2, '2GB', 'Glo 2GB Corporate', '2GB', '30 Days', 360, 400, 'corporate');

-- Insert 9mobile Data Plans
INSERT INTO public.data_plans (provider, network, service_id, plan_id, name, display_name, data_amount, validity, api_price, selling_price, category) VALUES
  ('isquare', '9mobile', 33, 1, '500MB', '9mobile 500MB', '500MB', '30 Days', 95, 105, 'sme'),
  ('isquare', '9mobile', 33, 2, '1GB', '9mobile 1GB', '1GB', '30 Days', 185, 205, 'sme'),
  ('isquare', '9mobile', 33, 3, '2GB', '9mobile 2GB', '2GB', '30 Days', 370, 410, 'sme'),
  ('isquare', '9mobile', 33, 4, '5GB', '9mobile 5GB', '5GB', '30 Days', 925, 1020, 'sme');

-- Insert Airtime Plans with discount percentages
INSERT INTO public.airtime_plans (provider, network, discount_percent, min_amount, max_amount) VALUES
  ('isquare', 'mtn', 3.0, 50, 50000),
  ('isquare', 'airtel', 3.5, 50, 50000),
  ('isquare', 'glo', 4.0, 50, 50000),
  ('isquare', '9mobile', 4.0, 50, 50000),
  ('rgc', 'mtn', 2.5, 50, 50000),
  ('rgc', 'airtel', 3.0, 50, 50000),
  ('rgc', 'glo', 3.5, 50, 50000),
  ('rgc', '9mobile', 3.5, 50, 50000);