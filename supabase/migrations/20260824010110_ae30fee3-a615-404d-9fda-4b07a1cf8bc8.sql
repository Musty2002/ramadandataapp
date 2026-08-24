CREATE TABLE public.plan_price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.data_plans(id) ON DELETE CASCADE,
  provider text NOT NULL,
  network text NOT NULL,
  display_name text NOT NULL,
  old_api_price numeric NOT NULL,
  new_api_price numeric NOT NULL,
  selling_price numeric NOT NULL,
  margin numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plan_price_history TO authenticated;
GRANT ALL ON public.plan_price_history TO service_role;

ALTER TABLE public.plan_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view plan price history"
ON public.plan_price_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_plan_price_history_created_at ON public.plan_price_history (created_at DESC);