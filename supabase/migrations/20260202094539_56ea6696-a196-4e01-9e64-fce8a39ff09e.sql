-- Create referral_settings table for admin configuration
CREATE TABLE public.referral_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_funding_amount numeric NOT NULL DEFAULT 1000,
  referrer_bonus numeric NOT NULL DEFAULT 50,
  is_enabled boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO public.referral_settings (min_funding_amount, referrer_bonus, is_enabled, requires_approval)
VALUES (1000, 50, true, true);

-- Enable RLS
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for referral_settings
CREATE POLICY "Anyone can view referral settings"
ON public.referral_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can update referral settings"
ON public.referral_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add new columns to referrals table
ALTER TABLE public.referrals 
ADD COLUMN funding_amount numeric DEFAULT NULL,
ADD COLUMN funding_triggered_at timestamp with time zone DEFAULT NULL,
ADD COLUMN approved_by uuid REFERENCES auth.users(id) DEFAULT NULL,
ADD COLUMN approved_at timestamp with time zone DEFAULT NULL;

-- Create policy for admins to update referrals (for approval)
CREATE POLICY "Admins can update referrals"
ON public.referrals FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create policy for admins to view all referrals
CREATE POLICY "Admins can view all referrals"
ON public.referrals FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));