import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Download, Loader2, Save, Check, X } from 'lucide-react';

interface ApiPlan {
  provider: string;
  network: string;
  category: string;
  service_id: number;
  plan_id: number;
  name: string;
  display_name: string;
  data_amount: string;
  validity: string;
  api_price: number;
  selling_price: number;
  is_active: boolean;
  db_id: string | null;
  in_database: boolean;
}

interface Category {
  id: string;
  name: string;
  service_id?: number;
}

const NETWORKS = ['mtn', 'airtel', 'glo', '9mobile'];
const PROVIDERS = [
  { id: 'isquare', name: 'iSquare' },
  { id: 'rgc', name: 'RGC Data' },
];

export default function AdminDataPlans() {
  const [selectedNetwork, setSelectedNetwork] = useState<string>('mtn');
  const [selectedProvider, setSelectedProvider] = useState<string>('isquare');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [editedPlans, setEditedPlans] = useState<Record<string, Partial<ApiPlan>>>({});
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCategories = async () => {
    setLoadingCategories(true);
    setCategories([]);
    setSelectedCategory('');
    setPlans([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-data-plans', {
        body: { 
          action: 'fetch-categories',
          provider: selectedProvider,
          network: selectedNetwork
        }
      });

      if (error) throw error;

      if (data?.categories) {
        setCategories(data.categories);
        toast({
          title: 'Categories Loaded',
          description: `Found ${data.categories.length} categories for ${selectedNetwork.toUpperCase()}`,
        });
      }
    } catch (error: any) {
      console.error('Fetch categories error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to fetch categories',
      });
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchPlans = async () => {
    if (!selectedCategory) return;
    
    setLoadingPlans(true);
    setPlans([]);
    setEditedPlans({});
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-data-plans', {
        body: { 
          action: 'fetch-plans',
          provider: selectedProvider,
          network: selectedNetwork,
          category: selectedCategory
        }
      });

      if (error) throw error;

      if (data?.plans) {
        setPlans(data.plans);
        toast({
          title: 'Plans Fetched',
          description: `Found ${data.plans.length} plans from API`,
        });
      }
    } catch (error: any) {
      console.error('Fetch plans error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to fetch plans',
      });
    } finally {
      setLoadingPlans(false);
    }
  };

  const handlePriceChange = (planKey: string, value: string) => {
    const plan = plans.find(p => `${p.service_id}-${p.plan_id}` === planKey);
    if (!plan) return;

    setEditedPlans(prev => ({
      ...prev,
      [planKey]: {
        ...prev[planKey],
        selling_price: parseFloat(value) || 0,
      }
    }));
  };

  const handleStatusChange = (planKey: string, value: boolean) => {
    setEditedPlans(prev => ({
      ...prev,
      [planKey]: {
        ...prev[planKey],
        is_active: value,
      }
    }));
  };

  const savePlan = async (plan: ApiPlan) => {
    const planKey = `${plan.service_id}-${plan.plan_id}`;
    const edits = editedPlans[planKey];
    
    setSavingPlan(planKey);
    try {
      const updatedPlan = {
        ...plan,
        selling_price: edits?.selling_price ?? plan.selling_price,
        is_active: edits?.is_active ?? plan.is_active,
      };

      const { data, error } = await supabase.functions.invoke('sync-data-plans', {
        body: { 
          action: 'save-plan',
          plan: updatedPlan
        }
      });

      if (error) throw error;

      // Update local state
      setPlans(prev => prev.map(p => {
        if (`${p.service_id}-${p.plan_id}` === planKey) {
          return {
            ...p,
            ...updatedPlan,
            db_id: data.plan_id || p.db_id,
            in_database: true,
          };
        }
        return p;
      }));

      // Clear edits for this plan
      setEditedPlans(prev => {
        const { [planKey]: _, ...rest } = prev;
        return rest;
      });

      toast({
        title: 'Saved',
        description: `${plan.display_name} ${plan.in_database ? 'updated' : 'added to database'}`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save plan',
      });
    } finally {
      setSavingPlan(null);
    }
  };

  const getDisplayValue = (plan: ApiPlan, field: 'selling_price' | 'is_active') => {
    const planKey = `${plan.service_id}-${plan.plan_id}`;
    const edits = editedPlans[planKey];
    
    if (edits && edits[field] !== undefined) {
      return edits[field];
    }
    return plan[field];
  };

  const hasChanges = (plan: ApiPlan) => {
    const planKey = `${plan.service_id}-${plan.plan_id}`;
    return !!editedPlans[planKey];
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Data Plans</h1>
          <p className="text-muted-foreground">
            Fetch live plans from API providers and manage pricing
          </p>
        </div>

        {/* Step 1: Network Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">1</span>
              Select Network
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              {NETWORKS.map((network) => (
                <Button
                  key={network}
                  variant={selectedNetwork === network ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => {
                    setSelectedNetwork(network);
                    setCategories([]);
                    setSelectedCategory('');
                    setPlans([]);
                  }}
                >
                  {network.toUpperCase()}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Provider Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">2</span>
              Select API Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Select value={selectedProvider} onValueChange={(v) => {
                  setSelectedProvider(v);
                  setCategories([]);
                  setSelectedCategory('');
                  setPlans([]);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={fetchCategories} disabled={loadingCategories}>
                {loadingCategories ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Load Categories
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Category Selection */}
        {categories.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">3</span>
                Select Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Select value={selectedCategory} onValueChange={(v) => {
                    setSelectedCategory(v);
                    setPlans([]);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name} {cat.service_id ? `(Service ID: ${cat.service_id})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={fetchPlans} disabled={!selectedCategory || loadingPlans}>
                  {loadingPlans ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Fetch Plans
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Plans Management */}
        {plans.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">4</span>
                Manage Plans
              </CardTitle>
              <CardDescription>
                Toggle plans on/off and set your app prices. Changes are saved individually.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((plan) => {
                  const planKey = `${plan.service_id}-${plan.plan_id}`;
                  const sellingPrice = getDisplayValue(plan, 'selling_price') as number;
                  const isActive = getDisplayValue(plan, 'is_active') as boolean;
                  const margin = sellingPrice - plan.api_price;
                  const changed = hasChanges(plan);
                  
                  return (
                    <div
                      key={planKey}
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
                            onCheckedChange={(v) => handleStatusChange(planKey, v)}
                          />
                          {isActive ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="mb-3">
                        {plan.in_database ? (
                          <Badge variant="secondary" className="text-xs">In Database</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-600/30">New from API</Badge>
                        )}
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
                            value={sellingPrice}
                            onChange={(e) => handlePriceChange(planKey, e.target.value)}
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
                          ₦{margin.toLocaleString()} ({plan.api_price > 0 ? ((margin / plan.api_price) * 100).toFixed(1) : 0}%)
                        </Badge>
                      </div>

                      {/* Save Button */}
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => savePlan(plan)}
                        disabled={savingPlan === planKey}
                      >
                        {savingPlan === planKey ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-1" />
                            {plan.in_database ? 'Update' : 'Add to Database'}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {plans.length === 0 && categories.length > 0 && selectedCategory && !loadingPlans && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Click "Fetch Plans" to load plans from the API
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
