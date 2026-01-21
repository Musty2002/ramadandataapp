import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Loader2, Save, Check, X } from 'lucide-react';

interface DataPlan {
  id: string;
  network: string;
  name: string;
  display_name: string;
  category: string;
  data_amount: string | null;
  validity: string | null;
  api_price: number;
  selling_price: number;
  provider: string;
  is_active: boolean;
}

const networks = ['mtn', 'airtel', 'glo', '9mobile'];
const categoryLabels: Record<string, string> = {
  sme: 'SME',
  corporate: 'Corporate',
  awoof: 'Awoof',
  coupon: 'Coupon',
  gifting: 'Gifting',
};

export default function AdminDataPlans() {
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('mtn');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({});
  const [editedStatus, setEditedStatus] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch plans when network changes
  useEffect(() => {
    if (selectedNetwork) {
      fetchPlans(selectedNetwork);
    }
  }, [selectedNetwork]);

  // Set first category when categories change
  useEffect(() => {
    if (categories.length > 0 && !categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0]);
    }
  }, [categories]);

  const fetchPlans = async (network: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_plans')
        .select('*')
        .eq('network', network)
        .order('selling_price', { ascending: true });

      if (error) throw error;
      
      const allPlans = (data || []) as DataPlan[];
      setPlans(allPlans);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(allPlans.map(p => p.category).filter(Boolean))];
      setCategories(uniqueCategories);
      
      // Reset edited values
      setEditedPrices({});
      setEditedStatus({});
    } catch (error) {
      console.error('Error fetching data plans:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch data plans',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (planId: string, value: string) => {
    setEditedPrices(prev => ({ ...prev, [planId]: value }));
  };

  const handleStatusChange = (planId: string, value: boolean) => {
    setEditedStatus(prev => ({ ...prev, [planId]: value }));
  };

  const handleSave = async (plan: DataPlan) => {
    const newPrice = editedPrices[plan.id];
    const newStatus = editedStatus[plan.id];
    
    // Check if anything changed
    if (newPrice === undefined && newStatus === undefined) {
      return;
    }

    const price = newPrice !== undefined ? parseFloat(newPrice) : plan.selling_price;
    if (isNaN(price) || price < 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Price',
        description: 'Please enter a valid price',
      });
      return;
    }

    setSaving(plan.id);
    try {
      const updates: any = {
        updated_at: new Date().toISOString(),
      };
      
      if (newPrice !== undefined) {
        updates.selling_price = price;
      }
      if (newStatus !== undefined) {
        updates.is_active = newStatus;
      }

      const { error } = await supabase
        .from('data_plans')
        .update(updates)
        .eq('id', plan.id);

      if (error) throw error;

      toast({
        title: 'Saved',
        description: `${plan.display_name} updated`,
      });

      // Update local state
      setPlans(prev => prev.map(p => 
        p.id === plan.id 
          ? { ...p, selling_price: price, is_active: newStatus ?? p.is_active }
          : p
      ));
      
      // Clear edited state for this plan
      setEditedPrices(prev => {
        const { [plan.id]: _, ...rest } = prev;
        return rest;
      });
      setEditedStatus(prev => {
        const { [plan.id]: _, ...rest } = prev;
        return rest;
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update plan',
      });
    } finally {
      setSaving(null);
    }
  };

  const filteredPlans = plans.filter(p => p.category === selectedCategory);
  
  const hasChanges = (planId: string) => {
    return editedPrices[planId] !== undefined || editedStatus[planId] !== undefined;
  };

  const getDisplayPrice = (plan: DataPlan) => {
    return editedPrices[plan.id] !== undefined 
      ? editedPrices[plan.id] 
      : plan.selling_price.toString();
  };

  const getDisplayStatus = (plan: DataPlan) => {
    return editedStatus[plan.id] !== undefined 
      ? editedStatus[plan.id] 
      : plan.is_active;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Data Plans</h1>
            <p className="text-muted-foreground">Manage data plan prices</p>
          </div>
          <Button variant="outline" onClick={() => fetchPlans(selectedNetwork)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Network Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Network</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              {networks.map((network) => (
                <Button
                  key={network}
                  variant={selectedNetwork === network ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => setSelectedNetwork(network)}
                >
                  {network.toUpperCase()}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Selection */}
        {categories.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select Category</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${Math.min(categories.length, 5)}, 1fr)` }}>
                  {categories.map((cat) => (
                    <TabsTrigger key={cat} value={cat}>
                      {categoryLabels[cat] || cat.toUpperCase()}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Plans Grid */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {categoryLabels[selectedCategory] || selectedCategory.toUpperCase()} Plans
            </CardTitle>
            <CardDescription>
              Set your app prices below. Only the App Price is shown to users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredPlans.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                No plans found for this category
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlans.map((plan) => {
                  const appPrice = parseFloat(getDisplayPrice(plan)) || 0;
                  const margin = appPrice - plan.api_price;
                  const isActive = getDisplayStatus(plan);
                  const changed = hasChanges(plan.id);
                  
                  return (
                    <div
                      key={plan.id}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        changed ? 'border-primary bg-primary/5' : 'border-border bg-card'
                      } ${!isActive ? 'opacity-60' : ''}`}
                    >
                      {/* Plan Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {plan.data_amount || plan.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">{plan.validity}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isActive}
                            onCheckedChange={(v) => handleStatusChange(plan.id, v)}
                          />
                          {isActive ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>

                      {/* Prices */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">API Price</Label>
                          <div className="mt-1 p-2 rounded-lg bg-muted text-sm font-medium">
                            ₦{plan.api_price.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">App Price</Label>
                          <Input
                            type="number"
                            value={getDisplayPrice(plan)}
                            onChange={(e) => handlePriceChange(plan.id, e.target.value)}
                            className="mt-1 h-9"
                          />
                        </div>
                      </div>

                      {/* Margin */}
                      <div className="flex items-center justify-between text-xs mb-3">
                        <span className="text-muted-foreground">Margin:</span>
                        <Badge 
                          variant="outline" 
                          className={margin >= 0 ? 'text-green-600 border-green-600/30' : 'text-red-600 border-red-600/30'}
                        >
                          ₦{margin.toLocaleString()} ({((margin / plan.api_price) * 100).toFixed(1)}%)
                        </Badge>
                      </div>

                      {/* Provider Badge */}
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {plan.provider}
                        </Badge>
                        
                        {/* Save Button */}
                        <Button
                          size="sm"
                          onClick={() => handleSave(plan)}
                          disabled={!changed || saving === plan.id}
                          className={changed ? '' : 'invisible'}
                        >
                          {saving === plan.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
