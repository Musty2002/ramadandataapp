ALTER TYPE public.transaction_category ADD VALUE IF NOT EXISTS 'verification';

CREATE TABLE public.verification_prices (
  id_type text PRIMARY KEY CHECK (id_type IN ('bvn','nin')),
  api_price numeric NOT NULL,
  selling_price numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.verification_prices TO anon, authenticated;
GRANT UPDATE ON public.verification_prices TO authenticated;
GRANT ALL ON public.verification_prices TO service_role;
ALTER TABLE public.verification_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view verification prices" ON public.verification_prices FOR SELECT USING (true);
CREATE POLICY "Admins can update verification prices" ON public.verification_prices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.verification_prices (id_type, api_price, selling_price) VALUES ('bvn', 75, 100), ('nin', 100, 150);