import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ElectricityProvider {
  id: string;
  name: string;
  code: string;
  service_id: number;
  discount_percent: number;
}

export default function Electricity() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [providers, setProviders] = useState<ElectricityProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [meterType, setMeterType] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{
    name: string;
    address: string;
    verified: boolean;
  } | null>(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    fetchProviders();
    fetchBalance();
  }, []);

  const fetchProviders = async () => {
    const { data, error } = await supabase
      .from('electricity_providers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setProviders(data);
    }
  };

  const fetchBalance = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setBalance(Number(data.balance));
    }
  };

  const handleVerifyMeter = async () => {
    if (!selectedProvider || !meterNumber) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please select a provider and enter meter number',
      });
      return;
    }

    setIsVerifying(true);
    setCustomerInfo(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('buy-electricity', {
        body: {
          provider_code: selectedProvider,
          meter_number: meterNumber,
          meter_type: meterType,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      // Handle the URL parameter action
      const url = new URL(window.location.href);
      url.searchParams.set('action', 'verify');

      const verifyResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buy-electricity?action=verify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider_code: selectedProvider,
            meter_number: meterNumber,
            meter_type: meterType,
          }),
        }
      );

      const data = await verifyResponse.json();

      if (data.verified) {
        setCustomerInfo({
          name: data.customer_name,
          address: data.customer_address || '',
          verified: true,
        });
        toast({
          title: 'Meter Verified',
          description: `Customer: ${data.customer_name}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description: data.error || 'Could not verify meter number',
        });
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: 'Could not verify meter number. Please try again.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedProvider || !meterNumber || !amount || !customerInfo?.verified) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please verify meter and enter amount',
      });
      return;
    }

    const amountNum = Number(amount);
    if (amountNum < 500 || amountNum > 500000) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Amount must be between ₦500 and ₦500,000',
      });
      return;
    }

    if (amountNum > balance) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Balance',
        description: 'Please fund your wallet',
      });
      return;
    }

    setIsPurchasing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buy-electricity`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider_code: selectedProvider,
            meter_number: meterNumber,
            meter_type: meterType,
            amount: amountNum,
            customer_name: customerInfo.name,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Purchase Successful!',
          description: data.token 
            ? `Token: ${data.token}` 
            : 'Check your meter for the token',
        });
        navigate('/history');
      } else {
        toast({
          variant: 'destructive',
          title: 'Purchase Failed',
          description: data.error || 'Failed to purchase electricity',
        });
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast({
        variant: 'destructive',
        title: 'Purchase Failed',
        description: 'An error occurred. Please try again.',
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(price);
  };

  const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000];

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Electricity Bill</h1>
        </div>

        {/* Balance Card */}
        <div className="mx-4 mb-4 p-4 bg-gradient-to-r from-primary to-primary/80 rounded-xl">
          <p className="text-sm text-primary-foreground/80">Available Balance</p>
          <p className="text-2xl font-bold text-primary-foreground">{formatPrice(balance)}</p>
        </div>

        <div className="px-4 pb-6">
          {/* Provider Selection */}
          <div className="mb-6">
            <Label className="mb-3 block">Select Provider</Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {providers.map((provider) => (
                <button
                  key={provider.code}
                  onClick={() => {
                    setSelectedProvider(provider.code);
                    setCustomerInfo(null);
                  }}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    selectedProvider === provider.code
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <p className="text-xs font-medium truncate">{provider.name}</p>
                  <p className="text-[10px] text-success mt-1">{provider.discount_percent}% discount</p>
                </button>
              ))}
            </div>
          </div>

          {/* Meter Type */}
          <div className="mb-6">
            <Label className="mb-3 block">Meter Type</Label>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMeterType('prepaid');
                  setCustomerInfo(null);
                }}
                className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                  meterType === 'prepaid'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                <p className="font-medium">Prepaid</p>
              </button>
              <button
                onClick={() => {
                  setMeterType('postpaid');
                  setCustomerInfo(null);
                }}
                className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                  meterType === 'postpaid'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                <p className="font-medium">Postpaid</p>
              </button>
            </div>
          </div>

          {/* Meter Number */}
          <div className="mb-4">
            <Label htmlFor="meter">Meter Number</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="meter"
                placeholder="Enter meter number"
                value={meterNumber}
                onChange={(e) => {
                  setMeterNumber(e.target.value);
                  setCustomerInfo(null);
                }}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleVerifyMeter}
                disabled={isVerifying || !selectedProvider || !meterNumber}
              >
                {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
              </Button>
            </div>
          </div>

          {/* Customer Info */}
          {customerInfo?.verified && (
            <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-5 h-5 text-success" />
                <span className="text-sm font-medium text-success">Verified</span>
              </div>
              <p className="text-sm font-medium text-foreground">{customerInfo.name}</p>
              {customerInfo.address && (
                <p className="text-xs text-muted-foreground mt-1">{customerInfo.address}</p>
              )}
            </div>
          )}

          {/* Amount */}
          <div className="mb-4">
            <Label htmlFor="amount">Amount (₦)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount (min ₦500)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* Quick Amounts */}
          <div className="mb-6">
            <Label className="mb-2 block text-sm">Quick Select</Label>
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                    amount === amt.toString()
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  {formatPrice(amt)}
                </button>
              ))}
            </div>
          </div>

          {/* Warning */}
          {!customerInfo?.verified && selectedProvider && meterNumber && (
            <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-warning">Please verify meter number before purchase</p>
            </div>
          )}

          {/* Pay Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handlePurchase}
            disabled={isPurchasing || !customerInfo?.verified || !amount}
          >
            {isPurchasing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              `Pay ${amount ? formatPrice(Number(amount)) : 'Bill'}`
            )}
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
