import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Check, Loader2, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

export default function Data() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch plans from database when network changes
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
      // Fetch all active plans for this network from the database
      const { data, error } = await supabase
        .from('data_plans')
        .select('*')
        .eq('network', network)
        .eq('is_active', true)
        .order('selling_price', { ascending: true });

      if (error) throw error;

      const allPlans = (data || []) as unknown as DataPlan[];
      setPlans(allPlans);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(allPlans.map(p => p.category).filter(Boolean))] as string[];
      setCategories(uniqueCategories);
      
      // Set default category
      if (uniqueCategories.length > 0) {
        setSelectedCategory(uniqueCategories[0]);
      } else {
        setSelectedCategory(null);
      }
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

  const handlePurchase = async () => {
    if (!selectedNetwork || !selectedPlan || !phoneNumber) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill in all fields',
      });
      return;
    }

    // Validate phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 11) {
      toast({
        variant: 'destructive',
        title: 'Invalid Phone Number',
        description: 'Please enter a valid 11-digit phone number',
      });
      return;
    }

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

      const { data, error } = await supabase.functions.invoke('buy-data', {
        body: {
          plan_id: selectedPlan.id,
          phone_number: cleanPhone,
        },
      });

      if (error) {
        // Parse edge function error
        const errorMessage = error.message || 'Purchase failed';
        throw new Error(errorMessage);
      }

      if (data?.success) {
        toast({
          title: 'Success',
          description: data.message,
        });
        // Reset form
        setSelectedPlan(null);
        setPhoneNumber('');
        navigate('/history');
      } else {
        throw new Error(data?.error || data?.details || 'Purchase failed');
      }
    } catch (error: unknown) {
      console.error('Purchase error:', error);
      const message = error instanceof Error ? error.message : 'Failed to purchase data. Please try again.';
      
      // Check for insufficient balance error
      const isInsufficientBalance = message.toLowerCase().includes('insufficient balance');
      
      toast({
        variant: 'destructive',
        title: isInsufficientBalance ? 'Insufficient Balance' : 'Purchase Failed',
        description: isInsufficientBalance 
          ? 'You don\'t have enough funds. Tap below to add money to your wallet.'
          : message,
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

  const filteredPlans = plans.filter(p => p.category === selectedCategory);

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      sme: 'SME',
      corporate: 'Corporate',
      awoof: 'Awoof',
      coupon: 'Coupon',
      gifting: 'Gifting',
      datashare: 'DataShare',
    };
    return labels[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Buy Data</h1>
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

          {/* Category Tabs - Show after network selection */}
          {selectedNetwork && categories.length > 0 && (
            <div className="mb-6">
              <Label className="mb-3 block">Select Category</Label>
              <Tabs value={selectedCategory || ''} onValueChange={setSelectedCategory}>
                <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${Math.min(categories.length, 4)}, 1fr)` }}>
                  {categories.map((cat) => (
                    <TabsTrigger key={cat} value={cat} className="text-xs">
                      {getCategoryLabel(cat)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Data Plans - Show after category selection */}
          {selectedNetwork && selectedCategory && (
            <div className="mb-6">
              <Label className="mb-3 block">Select Data Bundle</Label>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Loading plans...</span>
                </div>
              ) : filteredPlans.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No plans available for this category
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredPlans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                        selectedPlan?.id === plan.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card'
                      }`}
                    >
                      {selectedPlan?.id === plan.id && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
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

          {/* Phone Number - Show after plan selection */}
          {selectedPlan && (
            <div className="mb-6">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="08012345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-2"
                maxLength={11}
              />
            </div>
          )}

          {/* Selected Plan Summary */}
          {selectedPlan && (
            <div className="mb-4 p-4 rounded-xl bg-muted/50 border border-border">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Selected Plan</p>
                  <p className="font-semibold">{selectedPlan.display_name}</p>
                </div>
                <p className="text-lg font-bold text-primary">
                  {formatPrice(selectedPlan.selling_price)}
                </p>
              </div>
            </div>
          )}

          {/* Purchase Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handlePurchase}
            disabled={!selectedNetwork || !selectedPlan || !phoneNumber || purchasing}
          >
            {purchasing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Buy Data'
            )}
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
