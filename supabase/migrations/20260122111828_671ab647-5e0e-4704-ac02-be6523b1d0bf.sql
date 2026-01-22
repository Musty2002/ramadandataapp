-- Add RLS policies for admin to manage data_plans
CREATE POLICY "Admins can insert data plans"
  ON public.data_plans
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data plans"
  ON public.data_plans
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete data plans"
  ON public.data_plans
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));