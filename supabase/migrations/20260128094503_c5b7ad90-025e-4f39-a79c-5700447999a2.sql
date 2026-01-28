-- Create table for password reset OTP codes
CREATE TABLE public.password_reset_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_password_reset_otps_email ON public.password_reset_otps(email);
CREATE INDEX idx_password_reset_otps_expires ON public.password_reset_otps(expires_at);

-- Enable RLS (but allow edge functions to access via service role)
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- No public policies - only service role can access this table
-- This is intentional for security - OTPs should only be managed by edge functions