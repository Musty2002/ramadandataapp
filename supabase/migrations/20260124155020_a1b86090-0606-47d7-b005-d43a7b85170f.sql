-- Create push_subscriptions table to store FCM tokens
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, -- FCM token
  auth TEXT, -- Optional web push auth key
  p256dh TEXT, -- Optional web push p256dh key
  device_info JSONB, -- Optional device metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(endpoint)
);

-- Create notification_logs table to track sent notifications
CREATE TABLE public.notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  target_type TEXT NOT NULL DEFAULT 'all', -- 'all', 'user', 'segment'
  target_user_id UUID REFERENCES auth.users(id),
  sent_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on both tables
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for push_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Admin policies for push_subscriptions (to fetch all tokens)
CREATE POLICY "Admins can view all subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any subscription"
  ON public.push_subscriptions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for notification_logs
CREATE POLICY "Admins can view all notification logs"
  ON public.notification_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert notification logs"
  ON public.notification_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();