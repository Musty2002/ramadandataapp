import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const networks = [
  { id: 'mtn', name: 'MTN', color: 'bg-yellow-400' },
  { id: 'airtel', name: 'Airtel', color: 'bg-red-500' },
  { id: 'glo', name: 'Glo', color: 'bg-green-500' },
  { id: '9mobile', name: '9mobile', color: 'bg-green-700' },
];

interface DataPlan {
  id: string;
  provider: string;
  network: string;
  service_id: number;
  plan_id: number;
  name: string;
  display_name: string;
  validity: string | null;
  api_price: number;
  selling_price: number;
  category: string | null;
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
  const [selectedCategory, setSelectedCategory] = useState<string>('sme');

  // Fetch plans when network changes
  useEffect(() => {
    if (selectedNetwork) {
      fetchPlans(selectedNetwork);
    } else {
      setPlans([]);
      setCategories([]);
    }
    setSelectedPlan(null);
  }, [selectedNetwork]);

  const fetchPlans = async (network: string) => {
    setLoading(true);
    try {
      // Use raw query since data_plans table isn't in generated types yet
      const { data, error } = await supabase
        .from('data_plans' as any)
        .select('*')
        .eq('network', network)
        .eq('is_active', true)
        .order('selling_price', { ascending: true });

      if (error) throw error;

      const typedData = (data || []) as unknown as DataPlan[];
      setPlans(typedData);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(typedData.map(p => p.category).filter(Boolean))] as string[];
      setCategories(uniqueCategories);
      
      // Set default category
      if (uniqueCategories.length > 0 && !uniqueCategories.includes(selectedCategory)) {
        setSelectedCategory(uniqueCategories[0]);
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

      if (error) throw error;

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
        throw new Error(data?.error || 'Purchase failed');
      }
    } catch (error: unknown) {
      console.error('Purchase error:', error);
      const message = error instanceof Error ? error.message : 'Failed to purchase data. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Purchase Failed',
        description: message,
      });
    } finally {
      setPurchasing(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
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
    };
    return labels[category] || category.toUpperCase();
  };

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
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
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full ${network.color} mx-auto mb-2`} />
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
              placeholder="08012345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="mt-2"
              maxLength={11}
            />
          </div>

          {/* Category Tabs */}
          {selectedNetwork && categories.length > 0 && (
            <div className="mb-4">
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
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

          {/* Data Plans */}
          <div className="mb-6">
            <Label className="mb-3 block">Select Data Bundle</Label>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading plans...</span>
              </div>
            ) : !selectedNetwork ? (
              <p className="text-center text-muted-foreground py-4">
                Select a network to view available plans
              </p>
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
                    <p className="text-lg font-bold text-foreground">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{plan.validity}</p>
                    <p className="text-sm font-semibold text-primary mt-2">
                      {formatPrice(plan.selling_price)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

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
