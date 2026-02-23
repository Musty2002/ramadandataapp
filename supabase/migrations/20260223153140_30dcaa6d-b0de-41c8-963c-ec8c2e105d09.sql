
CREATE POLICY "Admins can update airtime plans"
ON public.airtime_plans
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert airtime plans"
ON public.airtime_plans
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete airtime plans"
ON public.airtime_plans
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
