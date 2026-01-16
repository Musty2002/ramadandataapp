import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CableProvider {
  id: string;
  name: string;
  code: string;
  service_id: number;
  discount_percent: number;
}

interface CableBouquet {
  id: string;
  provider_code: string;
  name: string;
  plan_id: number;
  price: number;
}

export default function TV() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [providers, setProviders] = useState<CableProvider[]>([]);
  const [bouquets, setBouquets] = useState<CableBouquet[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedBouquet, setSelectedBouquet] = useState<string | null>(null);
  const [smartCardNumber, setSmartCardNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{
    name: string;
    current_bouquet: string;
    due_date: string;
    verified: boolean;
  } | null>(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    fetchProviders();
    fetchBalance();
  }, []);

  useEffect(() => {
    if (selectedProvider) {
      fetchBouquets(selectedProvider);
    }
  }, [selectedProvider]);

  const fetchProviders = async () => {
    const { data, error } = await supabase
      .from('cable_providers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setProviders(data);
    }
  };

  const fetchBouquets = async (providerCode: string) => {
    const { data, error } = await supabase
      .from('cable_bouquets')
      .select('*')
      .eq('provider_code', providerCode)
      .eq('is_active', true)
      .order('price');

    if (!error && data) {
      setBouquets(data);
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

  const handleVerifySmartcard = async () => {
    if (!selectedProvider || !smartCardNumber) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please select a provider and enter smartcard number',
      });
      return;
    }

    setIsVerifying(true);
    setCustomerInfo(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buy-cable?action=verify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider_code: selectedProvider,
            smartcard_number: smartCardNumber,
          }),
        }
      );

      const data = await response.json();

      if (data.verified) {
        setCustomerInfo({
          name: data.customer_name,
          current_bouquet: data.current_bouquet || '',
          due_date: data.due_date || '',
          verified: true,
        });
        toast({
          title: 'Smartcard Verified',
          description: `Customer: ${data.customer_name}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description: data.error || 'Could not verify smartcard number',
        });
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: 'Could not verify smartcard. Please try again.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedProvider || !smartCardNumber || !selectedBouquet || !customerInfo?.verified) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please verify smartcard and select a bouquet',
      });
      return;
    }

    const bouquet = bouquets.find(b => b.id === selectedBouquet);
    if (!bouquet) return;

    if (bouquet.price > balance) {
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buy-cable`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider_code: selectedProvider,
            smartcard_number: smartCardNumber,
            bouquet_id: selectedBouquet,
            customer_name: customerInfo.name,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Subscription Successful!',
          description: data.message,
        });
        navigate('/history');
      } else {
        toast({
          variant: 'destructive',
          title: 'Subscription Failed',
          description: data.error || 'Failed to subscribe',
        });
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast({
        variant: 'destructive',
        title: 'Subscription Failed',
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

  const getProviderColor = (code: string) => {
    const colors: Record<string, string> = {
      dstv: 'bg-blue-600',
      gotv: 'bg-green-600',
      startimes: 'bg-orange-500',
    };
    return colors[code] || 'bg-gray-500';
  };

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">TV Subscription</h1>
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
            <div className="grid grid-cols-3 gap-3">
              {providers.map((provider) => (
                <button
                  key={provider.code}
                  onClick={() => {
                    setSelectedProvider(provider.code);
                    setSelectedBouquet(null);
                    setCustomerInfo(null);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedProvider === provider.code
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full ${getProviderColor(provider.code)} mx-auto mb-2 flex items-center justify-center`}>
                    <span className="text-white font-bold text-xs">{provider.name.charAt(0)}</span>
                  </div>
                  <p className="text-sm font-medium text-center">{provider.name}</p>
                  <p className="text-[10px] text-success text-center mt-1">{provider.discount_percent}% off</p>
                </button>
              ))}
            </div>
          </div>

          {/* Smart Card Number */}
          <div className="mb-4">
            <Label htmlFor="smartcard">Smart Card / IUC Number</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="smartcard"
                placeholder="Enter smartcard number"
                value={smartCardNumber}
                onChange={(e) => {
                  setSmartCardNumber(e.target.value);
                  setCustomerInfo(null);
                }}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleVerifySmartcard}
                disabled={isVerifying || !selectedProvider || !smartCardNumber}
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
              {customerInfo.current_bouquet && (
                <p className="text-xs text-muted-foreground mt-1">Current: {customerInfo.current_bouquet}</p>
              )}
              {customerInfo.due_date && (
                <p className="text-xs text-muted-foreground">Due: {customerInfo.due_date}</p>
              )}
            </div>
          )}

          {/* Warning */}
          {!customerInfo?.verified && selectedProvider && smartCardNumber && (
            <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-warning">Please verify smartcard before purchase</p>
            </div>
          )}

          {/* Package Selection */}
          {selectedProvider && customerInfo?.verified && (
            <div className="mb-6">
              <Label className="mb-3 block">Select Package</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {bouquets.map((bouquet) => (
                  <button
                    key={bouquet.id}
                    onClick={() => setSelectedBouquet(bouquet.id)}
                    className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                      selectedBouquet === bouquet.id
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-medium text-foreground">{bouquet.name}</p>
                      <p className="text-sm text-primary font-semibold">{formatPrice(bouquet.price)}</p>
                    </div>
                    {selectedBouquet === bouquet.id && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subscribe Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handlePurchase}
            disabled={isPurchasing || !customerInfo?.verified || !selectedBouquet}
          >
            {isPurchasing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              `Subscribe ${selectedBouquet ? formatPrice(bouquets.find(b => b.id === selectedBouquet)?.price || 0) : ''}`
            )}
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
