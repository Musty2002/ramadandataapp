import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Download, Loader2, Plus, Trash2, RefreshCw, Database, Cloud } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface DbPlan {
  id: string;
  provider: string;
  network: string;
  category: string;
  service_id: number | null;
  plan_id: number | null;
  product_id: string | null;
  name: string;
  display_name: string;
  data_amount: string | null;
  validity: string | null;
  api_price: number;
  selling_price: number;
  is_active: boolean;
}

interface ApiPlan {
  provider: string;
  network: string;
  category: string;
  service_id: number;
  plan_id: number;
  product_id?: string;
  name: string;
  display_name: string;
  data_amount: string;
  validity: string;
  api_price: number;
  selling_price: number;
  is_active: boolean;
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
  { id: 'albarka', name: 'Albarka' },
];

function getInvokeErrorMessage(error: any): string {
  // Supabase function invocation errors often hide the real message in `error.context.body`.
  const rawBody = error?.context?.body;
  if (typeof rawBody === 'string') {
    try {
      const parsed = JSON.parse(rawBody);
      return parsed?.details || parsed?.error || error?.message || 'Request failed';
    } catch {
      // ignore
    }
  }
  return error?.message || 'Request failed';
}

export default function AdminDataPlans() {
  const [activeTab, setActiveTab] = useState('database');
  
  // Database plans state
  const [dbPlans, setDbPlans] = useState<DbPlan[]>([]);
  const [loadingDbPlans, setLoadingDbPlans] = useState(false);
  const [selectedDbNetwork, setSelectedDbNetwork] = useState<string>('all');
  const [editingPlan, setEditingPlan] = useState<DbPlan | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  
  // API fetch state
  const [selectedNetwork, setSelectedNetwork] = useState<string>('mtn');
  const [selectedProvider, setSelectedProvider] = useState<string>('isquare');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [apiPlans, setApiPlans] = useState<ApiPlan[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingApiPlans, setLoadingApiPlans] = useState(false);
  const [addingPlan, setAddingPlan] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Fetch database plans
  const fetchDbPlans = async () => {
    setLoadingDbPlans(true);
    try {
      const { data, error } = await supabase
        .from('data_plans')
        .select('*')
        .order('network')
        .order('selling_price');

      if (error) throw error;
      setDbPlans(data || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to fetch plans',
      });
    } finally {
      setLoadingDbPlans(false);
    }
  };

  useEffect(() => {
    fetchDbPlans();
  }, []);

  // Filter database plans
  const filteredDbPlans = selectedDbNetwork === 'all' 
    ? dbPlans 
    : dbPlans.filter(p => p.network === selectedDbNetwork);

  // Update plan in database
  const updatePlan = async () => {
    if (!editingPlan) return;
    setSavingPlan(true);
    try {
      const { error } = await supabase
        .from('data_plans')
        .update({
          selling_price: editingPlan.selling_price,
          is_active: editingPlan.is_active,
          display_name: editingPlan.display_name,
        })
        .eq('id', editingPlan.id);

      if (error) throw error;

      setDbPlans(prev => prev.map(p => 
        p.id === editingPlan.id ? editingPlan : p
      ));
      setEditingPlan(null);
      toast({ title: 'Plan updated successfully' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update plan',
      });
    } finally {
      setSavingPlan(false);
    }
  };

  // Delete plan from database
  const deletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;
    
    try {
      const { error } = await supabase
        .from('data_plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;

      setDbPlans(prev => prev.filter(p => p.id !== planId));
      toast({ title: 'Plan deleted' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete plan',
      });
    }
  };

  // Toggle plan active status quickly
  const togglePlanStatus = async (plan: DbPlan) => {
    try {
      const { error } = await supabase
        .from('data_plans')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id);

      if (error) throw error;

      setDbPlans(prev => prev.map(p => 
        p.id === plan.id ? { ...p, is_active: !p.is_active } : p
      ));
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update status',
      });
    }
  };

  // Fetch categories from API
  const fetchCategories = async () => {
    setLoadingCategories(true);
    setCategories([]);
    setSelectedCategory('');
    setApiPlans([]);
    
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
          description: `Found ${data.categories.length} categories`,
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: getInvokeErrorMessage(error) || 'Failed to fetch categories',
      });
    } finally {
      setLoadingCategories(false);
    }
  };

  // Fetch plans from API
  const fetchApiPlans = async () => {
    if (!selectedCategory) return;
    
    setLoadingApiPlans(true);
    setApiPlans([]);
    
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
        setApiPlans(data.plans);
        toast({
          title: 'Plans Fetched',
          description: `Found ${data.plans.length} plans`,
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: getInvokeErrorMessage(error) || 'Failed to fetch plans',
      });
    } finally {
      setLoadingApiPlans(false);
    }
  };

  // Add plan to database with custom price
  const addPlanToDatabase = async (plan: ApiPlan, customPrice: number) => {
    const planKey = `${plan.service_id}-${plan.plan_id}`;
    setAddingPlan(planKey);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-data-plans', {
        body: { 
          action: 'save-plan',
          plan: {
            ...plan,
            selling_price: customPrice,
            is_active: true,
          }
        }
      });

      if (error) throw error;

      // Refresh database plans
      await fetchDbPlans();
      
      // Mark as in database
      setApiPlans(prev => prev.map(p => 
        `${p.service_id}-${p.plan_id}` === planKey 
          ? { ...p, in_database: true }
          : p
      ));

      toast({ title: 'Plan added to database' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: getInvokeErrorMessage(error) || 'Failed to add plan',
      });
    } finally {
      setAddingPlan(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Data Plans</h1>
          <p className="text-muted-foreground">
            Manage your data plans and pricing
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="database" className="gap-2">
              <Database className="h-4 w-4" />
              My Plans ({dbPlans.length})
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2">
              <Cloud className="h-4 w-4" />
              Add from API
            </TabsTrigger>
          </TabsList>

          {/* Database Plans Tab */}
          <TabsContent value="database" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Active Plans</CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={selectedDbNetwork} onValueChange={setSelectedDbNetwork}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Networks</SelectItem>
                        {NETWORKS.map(n => (
                          <SelectItem key={n} value={n}>{n.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={fetchDbPlans} disabled={loadingDbPlans}>
                      <RefreshCw className={`h-4 w-4 ${loadingDbPlans ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDbPlans ? (
                  <div className="py-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : filteredDbPlans.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No plans in database</p>
                    <p className="text-sm">Go to "Add from API" tab to fetch and add plans</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Network</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Validity</TableHead>
                          <TableHead className="text-right">API Price</TableHead>
                          <TableHead className="text-right">Your Price</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                          <TableHead className="text-center">Active</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDbPlans.map((plan) => {
                          const margin = plan.selling_price - plan.api_price;
                          return (
                            <TableRow key={plan.id} className={!plan.is_active ? 'opacity-50' : ''}>
                              <TableCell>
                                <Badge variant="outline" className="uppercase">
                                  {plan.network}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{plan.data_amount || plan.name}</p>
                                  <p className="text-xs text-muted-foreground">{plan.category}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {plan.validity || '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                ₦{plan.api_price.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                ₦{plan.selling_price.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={`font-mono text-sm ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ₦{margin.toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={plan.is_active}
                                  onCheckedChange={() => togglePlanStatus(plan)}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingPlan(plan)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => deletePlan(plan.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Add from API Tab */}
          <TabsContent value="api" className="space-y-4">
            {/* Step 1: Select Network & Provider */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">1. Select Network & Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs text-muted-foreground mb-2 block">Network</Label>
                    <div className="flex gap-2">
                      {NETWORKS.map((network) => (
                        <Button
                          key={network}
                          size="sm"
                          variant={selectedNetwork === network ? 'default' : 'outline'}
                          onClick={() => {
                            setSelectedNetwork(network);
                            setCategories([]);
                            setSelectedCategory('');
                            setApiPlans([]);
                          }}
                        >
                          {network.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-[200px]">
                    <Label className="text-xs text-muted-foreground mb-2 block">Provider</Label>
                    <div className="flex gap-2">
                      <Select value={selectedProvider} onValueChange={(v) => {
                        setSelectedProvider(v);
                        setCategories([]);
                        setSelectedCategory('');
                        setApiPlans([]);
                      }}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDERS.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={fetchCategories} disabled={loadingCategories}>
                        {loadingCategories ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Select Category & Fetch */}
            {categories.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">2. Select Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {categories.map((cat) => (
                      <Button
                        key={cat.id}
                        size="sm"
                        variant={selectedCategory === cat.id ? 'default' : 'outline'}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setApiPlans([]);
                        }}
                      >
                        {cat.name}
                      </Button>
                    ))}
                  </div>
                  {selectedCategory && (
                    <Button 
                      className="mt-4" 
                      onClick={fetchApiPlans} 
                      disabled={loadingApiPlans}
                    >
                      {loadingApiPlans ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Fetch Plans
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Add Plans */}
            {apiPlans.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">3. Add Plans to Your Database</CardTitle>
                  <CardDescription>
                    Set your selling price and add plans. Already added plans are marked.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {apiPlans.map((plan) => {
                      const planKey = `${plan.service_id}-${plan.plan_id}`;
                      const isAdding = addingPlan === planKey;
                      
                      return (
                        <ApiPlanRow
                          key={planKey}
                          plan={plan}
                          isAdding={isAdding}
                          onAdd={addPlanToDatabase}
                        />
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Plan Dialog */}
        <Dialog open={!!editingPlan} onOpenChange={() => setEditingPlan(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Plan</DialogTitle>
            </DialogHeader>
            {editingPlan && (
              <div className="space-y-4">
                <div>
                  <Label>Display Name</Label>
                  <Input
                    value={editingPlan.display_name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, display_name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>API Price</Label>
                    <Input value={`₦${editingPlan.api_price}`} disabled />
                  </div>
                  <div>
                    <Label>Your Selling Price</Label>
                    <Input
                      type="number"
                      value={editingPlan.selling_price}
                      onChange={(e) => setEditingPlan({ 
                        ...editingPlan, 
                        selling_price: parseFloat(e.target.value) || 0 
                      })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch
                    checked={editingPlan.is_active}
                    onCheckedChange={(v) => setEditingPlan({ ...editingPlan, is_active: v })}
                  />
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Margin:</span>
                    <span className={`font-medium ${
                      editingPlan.selling_price - editingPlan.api_price >= 0 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      ₦{(editingPlan.selling_price - editingPlan.api_price).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPlan(null)}>
                Cancel
              </Button>
              <Button onClick={updatePlan} disabled={savingPlan}>
                {savingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

// Separate component for API plan row with local price state
function ApiPlanRow({ 
  plan, 
  isAdding, 
  onAdd 
}: { 
  plan: ApiPlan; 
  isAdding: boolean; 
  onAdd: (plan: ApiPlan, price: number) => void;
}) {
  const [customPrice, setCustomPrice] = useState(plan.selling_price || plan.api_price);
  const margin = customPrice - plan.api_price;

  return (
    <div className={`flex items-center gap-4 p-3 rounded-lg border ${
      plan.in_database ? 'bg-muted/50 opacity-60' : 'bg-card'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{plan.data_amount || plan.name}</span>
          <span className="text-xs text-muted-foreground">{plan.validity}</span>
          {plan.in_database && (
            <Badge variant="secondary" className="text-xs">Added</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          API: ₦{plan.api_price.toLocaleString()}
        </p>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="w-28">
          <Input
            type="number"
            value={customPrice}
            onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
            placeholder="Your price"
            disabled={plan.in_database}
            className="h-9"
          />
        </div>
        <div className="w-20 text-right">
          <span className={`text-sm font-mono ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            +₦{margin.toLocaleString()}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => onAdd(plan, customPrice)}
          disabled={isAdding || plan.in_database}
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : plan.in_database ? (
            'Added'
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
