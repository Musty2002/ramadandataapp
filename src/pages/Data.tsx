import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Check, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { supabase } from '@/integrations/supabase/client';
import { TransactionReceipt } from '@/components/TransactionReceipt';
import { TransactionPinDialog, isTransactionPinSetup } from '@/components/auth/TransactionPinDialog';


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

interface DataPlan {
  id: string;
  provider: string;
  network: string;
  service_id: number;
  plan_id: number;
  product_id: string | null;
  name: string;
  display_name: string;
  data_amount: string | null;
  validity: string | null;
  api_price: number;
  selling_price: number;
  category: string;
}

type Step = 'network' | 'category' | 'plan' | 'confirm';

export default function Data() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('network');
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Receipt state
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<{
    id: string;
    date: Date;
    phoneNumber: string;
    network: string;
    amount: number;
    type: 'data';
    dataPlan: string;
  } | null>(null);
  
  // PIN verification state
  const [showPinDialog, setShowPinDialog] = useState(false);

  useEffect(() => {
    if (selectedNetwork) {
      fetchPlans(selectedNetwork);
    } else {
      setPlans([]);
      setCategories([]);
      setSelectedCategory(null);
    }
    setSelectedPlan(null);
  }, [selectedNetwork]);

  const fetchPlans = async (network: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_plans')
        .select('*')
        .eq('network', network)
        .eq('is_active', true)
        .order('selling_price', { ascending: true });

      if (error) throw error;

      const allPlans = (data || []) as unknown as DataPlan[];
      setPlans(allPlans);
      
      const uniqueCategories = [...new Set(allPlans.map(p => p.category).filter(Boolean))] as string[];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load data plans',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNetworkSelect = (networkId: string) => {
    setSelectedNetwork(networkId);
    setStep('category');
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setStep('plan');
  };

  const handlePlanSelect = (plan: DataPlan) => {
    setSelectedPlan(plan);
    setStep('confirm');
  };

  const handleBack = () => {
    switch (step) {
      case 'category':
        setStep('network');
        setSelectedNetwork(null);
        break;
      case 'plan':
        setStep('category');
        setSelectedCategory(null);
        break;
      case 'confirm':
        setStep('plan');
        setSelectedPlan(null);
        break;
      default:
        navigate('/dashboard');
    }
  };

  const initiateTransaction = () => {
    if (!selectedNetwork || !selectedPlan || !phoneNumber) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill in all fields',
      });
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 11) {
      toast({
        variant: 'destructive',
        title: 'Invalid Phone Number',
        description: 'Please enter a valid 11-digit phone number',
      });
      return;
    }

    // Check if PIN is setup
    if (isTransactionPinSetup()) {
      setShowPinDialog(true);
    } else {
      handlePurchase();
    }
  };

  const handlePurchase = async () => {
    setShowPinDialog(false);
    setPurchasing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          variant: 'destructive',
          title: 'Not Logged In',
          description: 'Please log in to purchase data',
        });
        navigate('/auth');
        return;
      }

      const cleanPhone = phoneNumber.replace(/\D/g, '');

      const { data, error } = await supabase.functions.invoke('buy-data', {
        body: {
          plan_id: selectedPlan!.id,
          phone_number: cleanPhone,
        },
      });

      // Check for SDK-level errors
      if (error) {
        throw new Error(error.message || 'Purchase failed');
      }

      // Check for API-level errors (returned in data.error)
      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success) {
        // Show receipt
        setLastTransaction({
          id: data.transaction_id || crypto.randomUUID(),
          date: new Date(),
          phoneNumber: cleanPhone,
          network: selectedNetwork!,
          amount: selectedPlan!.selling_price,
          type: 'data',
          dataPlan: selectedPlan!.display_name || selectedPlan!.data_amount || selectedPlan!.name,
        });
        setShowReceipt(true);
        
        toast({
          title: 'Success',
          description: data.message || 'Data purchase successful!',
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
          : errorMessage || 'Failed to purchase data. Please try again.',
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

  const handleReceiptClose = () => {
    setShowReceipt(false);
    setSelectedPlan(null);
    setPhoneNumber('');
    setStep('network');
    setSelectedNetwork(null);
    navigate('/history');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const filteredPlans = plans.filter(p => p.category === selectedCategory);

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      sme: 'SME Data',
      corporate: 'Corporate',
      awoof: 'Awoof Data',
      coupon: 'Coupon',
      gifting: 'Gifting',
      datashare: 'DataShare',
    };
    return labels[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const getStepTitle = () => {
    switch (step) {
      case 'network': return 'Select Network';
      case 'category': return 'Select Category';
      case 'plan': return 'Select Data Plan';
      case 'confirm': return 'Confirm Purchase';
    }
  };

  const networkData = networks.find(n => n.id === selectedNetwork);

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={handleBack} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">{getStepTitle()}</h1>
        </div>

        {/* Step indicator */}
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between max-w-xs mx-auto">
            {['network', 'category', 'plan', 'confirm'].map((s, i) => {
              const stepIndex = ['network', 'category', 'plan', 'confirm'].indexOf(step);
              const isActive = i <= stepIndex;
              const isCurrent = s === step;
              return (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    isCurrent 
                      ? 'bg-primary text-primary-foreground scale-110' 
                      : isActive 
                        ? 'bg-primary/20 text-primary' 
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {i + 1}
                  </div>
                  {i < 3 && (
                    <div className={`w-8 h-0.5 ${isActive && i < stepIndex ? 'bg-primary' : 'bg-muted'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-6">
          {/* Step 1: Network Selection */}
          {step === 'network' && (
            <div className="grid grid-cols-2 gap-4">
              {networks.map((network) => (
                <button
                  key={network.id}
                  onClick={() => handleNetworkSelect(network.id)}
                  className="p-6 rounded-2xl border-2 transition-all bg-card hover:border-primary/50 hover:shadow-md active:scale-95"
                >
                  <div className="w-16 h-16 rounded-full mx-auto mb-3 overflow-hidden shadow-md">
                    <img 
                      src={network.logo} 
                      alt={`${network.name} logo`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-sm font-semibold text-center">{network.name}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Category Selection */}
          {step === 'category' && (
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Loading categories...</span>
                </div>
              ) : categories.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No data plans available for this network
                </p>
              ) : (
                categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => handleCategorySelect(category)}
                    className="w-full p-4 rounded-xl border-2 bg-card flex items-center justify-between hover:border-primary/50 hover:shadow-sm transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      {networkData && (
                        <div className="w-10 h-10 rounded-full overflow-hidden">
                          <img src={networkData.logo} alt={networkData.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <span className="font-semibold">{getCategoryLabel(category)}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          )}

          {/* Step 3: Plan Selection */}
          {step === 'plan' && (
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Loading plans...</span>
                </div>
              ) : filteredPlans.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No plans available for this category
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredPlans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handlePlanSelect(plan)}
                      className="p-4 rounded-xl border-2 text-left transition-all bg-card hover:border-primary/50 hover:shadow-sm active:scale-[0.98]"
                    >
                      <p className="text-lg font-bold text-foreground">{plan.data_amount || plan.name}</p>
                      <p className="text-xs text-muted-foreground">{plan.validity}</p>
                      <p className="text-sm font-semibold text-primary mt-2">
                        {formatPrice(plan.selling_price)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && selectedPlan && (
            <div className="space-y-6">
              {/* Selected plan summary */}
              <div className="p-4 rounded-2xl bg-primary/5 border-2 border-primary/20">
                <div className="flex items-center gap-3 mb-4">
                  {networkData && (
                    <div className="w-12 h-12 rounded-full overflow-hidden shadow-md">
                      <img src={networkData.logo} alt={networkData.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{networkData?.name}</p>
                    <p className="text-sm text-muted-foreground">{getCategoryLabel(selectedCategory || '')}</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-3 border-t border-primary/20">
                  <div>
                    <p className="text-lg font-bold">{selectedPlan.data_amount || selectedPlan.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedPlan.validity}</p>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {formatPrice(selectedPlan.selling_price)}
                  </p>
                </div>
              </div>

              {/* Phone number input */}
              <div>
                <Label htmlFor="phone" className="text-base font-semibold">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="08012345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="mt-2 h-12 text-lg"
                  maxLength={11}
                />
              </div>

              {/* Purchase Button */}
              <Button
                className="w-full h-14 text-lg font-semibold"
                onClick={initiateTransaction}
                disabled={!phoneNumber || purchasing}
              >
                {purchasing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Pay ${formatPrice(selectedPlan.selling_price)}`
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Transaction PIN Dialog */}
      <TransactionPinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        onComplete={handlePurchase}
        mode="verify"
      />

      {/* Transaction Receipt */}
      {lastTransaction && (
        <TransactionReceipt
          open={showReceipt}
          onClose={handleReceiptClose}
          transaction={lastTransaction}
        />
      )}
    </MobileLayout>
  );
}
