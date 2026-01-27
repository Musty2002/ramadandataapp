import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { supabase } from '@/integrations/supabase/client';
import { TransactionPinDialog, isTransactionPinSetup } from '@/components/auth/TransactionPinDialog';
import { TransactionReceipt } from '@/components/TransactionReceipt';

import mtnLogo from '@/assets/mtn-logo.png';
import airtelLogo from '@/assets/airtel-logo.jpg';
import gloLogo from '@/assets/glo-logo.jpg';
import nineMobileLogo from '@/assets/9mobile-logo.jpg';

const networks = [
  { id: 'mtn', name: 'MTN', logo: mtnLogo },
  { id: 'airtel', name: 'Airtel', logo: airtelLogo },
  { id: 'glo', name: 'Glo', logo: gloLogo },
  { id: '9mobile', name: '9mobile', logo: nineMobileLogo },
];

const quickAmounts = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

// Nigerian phone number prefixes mapped to networks
const networkPrefixes: Record<string, string[]> = {
  mtn: ['0703', '0706', '0803', '0806', '0810', '0813', '0814', '0816', '0903', '0906', '0913', '0916'],
  airtel: ['0701', '0708', '0802', '0808', '0812', '0901', '0902', '0904', '0907', '0912'],
  glo: ['0705', '0805', '0807', '0811', '0815', '0905', '0915'],
  '9mobile': ['0809', '0817', '0818', '0908', '0909'],
};

// Function to detect network from phone number
const detectNetwork = (phone: string): string | null => {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 4) return null;
  
  const prefix = cleanPhone.substring(0, 4);
  
  for (const [network, prefixes] of Object.entries(networkPrefixes)) {
    if (prefixes.includes(prefix)) {
      return network;
    }
  }
  return null;
};

interface AirtimePlan {
  id: string;
  provider: string;
  network: string;
  discount_percent: number;
  min_amount: number;
  max_amount: number;
}

interface LastTransaction {
  id: string;
  date: Date;
  phoneNumber: string;
  network: string;
  amount: number;
  type: 'airtime';
}

export default function Airtime() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [bestPlan, setBestPlan] = useState<AirtimePlan | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<LastTransaction | null>(null);

  // Fetch best airtime plan when network changes
  useEffect(() => {
    if (selectedNetwork) {
      fetchBestAirtimePlan(selectedNetwork);
    } else {
      setBestPlan(null);
    }
  }, [selectedNetwork]);

  const fetchBestAirtimePlan = async (network: string) => {
    try {
      // Fetch all airtime plans for this network from both providers
      const { data, error } = await supabase
        .from('airtime_plans' as any)
        .select('*')
        .eq('network', network)
        .eq('is_active', true)
        .order('discount_percent', { ascending: false });

      if (error) throw error;

      const plans = (data || []) as unknown as AirtimePlan[];
      
      // Pick the plan with the highest discount (cheapest for user)
      if (plans.length > 0) {
        setBestPlan(plans[0]);
      }
    } catch (error) {
      console.error('Error fetching airtime plans:', error);
    }
  };

  const validateForm = () => {
    if (!selectedNetwork || !phoneNumber || !amount) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill in all fields',
      });
      return false;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 50) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Minimum airtime amount is ₦50',
      });
      return false;
    }

    // Validate phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 11) {
      toast({
        variant: 'destructive',
        title: 'Invalid Phone Number',
        description: 'Please enter a valid 11-digit phone number',
      });
      return false;
    }

    return true;
  };

  const handlePurchaseClick = () => {
    if (!validateForm()) return;

    // Check if PIN is setup
    if (isTransactionPinSetup()) {
      setShowPinDialog(true);
    } else {
      // If no PIN setup, proceed directly
      executePurchase();
    }
  };

  const handlePinVerified = () => {
    setShowPinDialog(false);
    executePurchase();
  };

  const executePurchase = async () => {
    setPurchasing(true);
    setPendingPurchase(false);
    
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const amountValue = parseFloat(amount);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          variant: 'destructive',
          title: 'Not Logged In',
          description: 'Please log in to purchase airtime',
        });
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase.functions.invoke('buy-airtime', {
        body: {
          network: selectedNetwork,
          phone_number: cleanPhone,
          amount: amountValue,
        },
      });

      // Handle errors - the SDK puts non-2xx responses in error, with body in error.context
      if (error) {
        // Try to extract the actual error message from the response
        let errorMessage = 'Purchase failed';
        try {
          // error.context contains the response body for non-2xx responses
          const context = (error as any).context;
          if (context?.body) {
            const bodyText = await new Response(context.body).text();
            const parsed = JSON.parse(bodyText);
            errorMessage = parsed.error || parsed.message || parsed.details || errorMessage;
          } else if (error.message) {
            // Try to extract JSON from error message
            const jsonMatch = error.message.match(/\{[^}]+\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              errorMessage = parsed.error || parsed.message || errorMessage;
            }
          }
        } catch {
          errorMessage = error.message || 'Purchase failed';
        }
        throw new Error(errorMessage);
      }

      // Handle API-level errors returned in the response body
      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success) {
        // Set last transaction for receipt
        setLastTransaction({
          id: data.transaction_id || crypto.randomUUID(),
          date: new Date(),
          phoneNumber: cleanPhone,
          network: selectedNetwork!,
          amount: amountValue,
          type: 'airtime',
        });
        setShowReceipt(true);
        
        toast({
          title: 'Success',
          description: data.message || 'Airtime purchase successful!',
        });
      } else {
        throw new Error(data?.details || 'Purchase failed');
      }
    } catch (error: unknown) {
      console.error('Purchase error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for insufficient balance
      const isInsufficientBalance = /insufficient (balance|funds)/i.test(errorMessage);
      
      toast({
        variant: 'destructive',
        title: isInsufficientBalance ? 'Insufficient Balance' : 'Purchase Failed',
        description: isInsufficientBalance 
          ? "You don't have enough funds in your wallet. Please add money to continue."
          : errorMessage || 'Failed to purchase airtime. Please try again.',
        action: isInsufficientBalance ? (
          <ToastAction altText="Add Money" onClick={() => navigate('/add-money')}>
            Add Money
          </ToastAction>
        ) : undefined,
      });
    } finally {
      setPurchasing(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Calculate discounted price
  const getDiscountedPrice = (amt: number) => {
    if (!bestPlan) return amt;
    return amt * (1 - bestPlan.discount_percent / 100);
  };

  const amountNum = parseFloat(amount) || 0;

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Buy Airtime</h1>
        </div>

        <div className="px-4 pb-6">
          {/* Network Selection */}
          <div className="mb-6">
            <Label className="mb-3 block">Select Network</Label>
            <div className="grid grid-cols-4 gap-3">
              {networks.map((network) => (
                <button
                  key={network.id}
                  onClick={() => setSelectedNetwork(network.id)}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    selectedNetwork === network.id
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full mx-auto mb-2 overflow-hidden shadow-sm ring-2 ring-offset-2 ring-offset-background ${
                    selectedNetwork === network.id ? 'ring-primary' : 'ring-transparent'
                  }`}>
                    <img 
                      src={network.logo} 
                      alt={`${network.name} logo`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs font-medium text-center">{network.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Phone Number */}
          <div className="mb-6">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="08012345678"
              value={phoneNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setPhoneNumber(value);
                
                // Auto-detect network from phone number
                const detected = detectNetwork(value);
                if (detected && detected !== selectedNetwork) {
                  setSelectedNetwork(detected);
                }
              }}
              className="mt-2"
              maxLength={11}
            />
            {selectedNetwork && phoneNumber.length >= 4 && (
              <p className="text-xs text-muted-foreground mt-1">
                Network detected: <span className="font-medium text-primary">{networks.find(n => n.id === selectedNetwork)?.name}</span>
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="mb-4">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              className="mt-2"
            />
          </div>

          {/* Quick Amounts */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    amount === amt.toString()
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-foreground'
                  }`}
                >
                  {formatPrice(amt)}
                </button>
              ))}
            </div>
          </div>

          {/* Price Summary with Discount */}
          {amountNum > 0 && bestPlan && (
            <div className="mb-4 p-4 rounded-xl bg-muted/50 border border-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Airtime Value</span>
                <span className="font-medium">{formatPrice(amountNum)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Discount ({bestPlan.discount_percent}%)</span>
                <span className="font-medium text-green-600">-{formatPrice(amountNum * bestPlan.discount_percent / 100)}</span>
              </div>
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">You Pay</span>
                  <span className="text-lg font-bold text-primary">{formatPrice(getDiscountedPrice(amountNum))}</span>
                </div>
              </div>
            </div>
          )}

          {/* Purchase Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handlePurchaseClick}
            disabled={!selectedNetwork || !phoneNumber || !amount || purchasing}
          >
            {purchasing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Buy Airtime'
            )}
          </Button>
        </div>
      </div>

      {/* Transaction PIN Dialog */}
      <TransactionPinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        onComplete={handlePinVerified}
        mode="verify"
        title="Enter Transaction PIN"
        description="Enter your 4-digit PIN to authorize this purchase"
      />

      {/* Transaction Receipt */}
      {lastTransaction && (
        <TransactionReceipt
          open={showReceipt}
          onClose={() => {
            setShowReceipt(false);
            setPhoneNumber('');
            setAmount('');
            navigate('/history');
          }}
          transaction={lastTransaction}
        />
      )}
    </MobileLayout>
  );
}