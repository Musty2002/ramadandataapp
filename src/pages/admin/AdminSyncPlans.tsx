import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Loader2, Download, Upload, Check, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  selling_price?: number;
}

export default function AdminSyncPlans() {
  const [fetchedPlans, setFetchedPlans] = useState<ApiPlan[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [markupPercent, setMarkupPercent] = useState('10');
  const { toast } = useToast();

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-data-plans', {
        body: { action: 'fetch' }
      });

      if (error) throw error;

      if (data?.plans) {
        // Add default selling price based on markup
        const markup = parseFloat(markupPercent) / 100;
        const plansWithPrices = data.plans.map((p: ApiPlan) => ({
          ...p,
          selling_price: Math.ceil(p.api_price * (1 + markup))
        }));
        
        setFetchedPlans(plansWithPrices);
        // Select all by default
        setSelectedPlans(new Set(plansWithPrices.map((p: ApiPlan) => `${p.service_id}-${p.plan_id}`)));
        
        toast({
          title: 'Plans Fetched',
          description: `Found ${plansWithPrices.length} plans from iSquare API`,
        });
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      toast({
        variant: 'destructive',
        title: 'Fetch Failed',
        description: error.message || 'Failed to fetch plans from API',
      });
    } finally {
      setLoading(false);
    }
  };

  const syncSelectedPlans = async () => {
    if (selectedPlans.size === 0) {
      toast({
        variant: 'destructive',
        title: 'No Plans Selected',
        description: 'Please select at least one plan to sync',
      });
      return;
    }

    setSyncing(true);
    try {
      const plansToSync = fetchedPlans.filter(p => 
        selectedPlans.has(`${p.service_id}-${p.plan_id}`)
      );

      const { data, error } = await supabase.functions.invoke('sync-data-plans', {
        body: { 
          action: 'sync',
          plans: plansToSync
        }
      });

      if (error) throw error;

      toast({
        title: 'Sync Complete',
        description: data.message,
      });

      // Also deactivate plans that are no longer in API
      const validKeys = Array.from(selectedPlans);
      await supabase.functions.invoke('sync-data-plans', {
        body: { 
          action: 'deactivate-missing',
          validPlanKeys: validKeys
        }
      });

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: error.message || 'Failed to sync plans',
      });
    } finally {
      setSyncing(false);
    }
  };

  const togglePlan = (key: string) => {
    const newSelected = new Set(selectedPlans);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedPlans(newSelected);
  };

  const toggleAll = () => {
    if (selectedPlans.size === fetchedPlans.length) {
      setSelectedPlans(new Set());
    } else {
      setSelectedPlans(new Set(fetchedPlans.map(p => `${p.service_id}-${p.plan_id}`)));
    }
  };

  const toggleNetwork = (network: string) => {
    const networkPlans = fetchedPlans.filter(p => p.network === network);
    const networkKeys = networkPlans.map(p => `${p.service_id}-${p.plan_id}`);
    const allSelected = networkKeys.every(k => selectedPlans.has(k));
    
    const newSelected = new Set(selectedPlans);
    if (allSelected) {
      networkKeys.forEach(k => newSelected.delete(k));
    } else {
      networkKeys.forEach(k => newSelected.add(k));
    }
    setSelectedPlans(newSelected);
  };

  const updateMarkup = () => {
    const markup = parseFloat(markupPercent) / 100;
    setFetchedPlans(prev => prev.map(p => ({
      ...p,
      selling_price: Math.ceil(p.api_price * (1 + markup))
    })));
  };

  const networks = [...new Set(fetchedPlans.map(p => p.network))];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Sync Data Plans</h1>
          <p className="text-muted-foreground">
            Fetch and import data plans from iSquare API
          </p>
        </div>

        {/* Step 1: Fetch Plans */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">1</span>
              Fetch Plans from API
            </CardTitle>
            <CardDescription>
              Retrieve the latest data plans from iSquare API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="space-y-2">
                <Label>Default Markup %</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={markupPercent}
                    onChange={(e) => setMarkupPercent(e.target.value)}
                    className="w-24"
                  />
                  {fetchedPlans.length > 0 && (
                    <Button variant="outline" size="sm" onClick={updateMarkup}>
                      Apply
                    </Button>
                  )}
                </div>
              </div>
              <Button onClick={fetchPlans} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Fetch Plans
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Review & Select */}
        {fetchedPlans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">2</span>
                Review & Select Plans
              </CardTitle>
              <CardDescription>
                {selectedPlans.size} of {fetchedPlans.length} plans selected
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Network Toggle Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedPlans.size === fetchedPlans.length ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleAll}
                >
                  {selectedPlans.size === fetchedPlans.length ? (
                    <Check className="h-4 w-4 mr-1" />
                  ) : null}
                  All
                </Button>
                {networks.map(network => {
                  const networkPlans = fetchedPlans.filter(p => p.network === network);
                  const networkKeys = networkPlans.map(p => `${p.service_id}-${p.plan_id}`);
                  const allSelected = networkKeys.every(k => selectedPlans.has(k));
                  const count = networkKeys.filter(k => selectedPlans.has(k)).length;
                  
                  return (
                    <Button
                      key={network}
                      variant={allSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleNetwork(network)}
                    >
                      {allSelected && <Check className="h-4 w-4 mr-1" />}
                      {network.toUpperCase()} ({count}/{networkPlans.length})
                    </Button>
                  );
                })}
              </div>

              {/* Plans Table */}
              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Network</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Validity</TableHead>
                      <TableHead>API Price</TableHead>
                      <TableHead>Selling Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fetchedPlans.map((plan) => {
                      const key = `${plan.service_id}-${plan.plan_id}`;
                      const isSelected = selectedPlans.has(key);
                      
                      return (
                        <TableRow key={key} className={isSelected ? '' : 'opacity-50'}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => togglePlan(key)}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{plan.network.toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell className="capitalize">{plan.category}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={plan.name}>
                            {plan.name}
                          </TableCell>
                          <TableCell>{plan.data_amount}</TableCell>
                          <TableCell>{plan.validity}</TableCell>
                          <TableCell>₦{plan.api_price.toLocaleString()}</TableCell>
                          <TableCell className="font-medium">
                            ₦{(plan.selling_price || 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Sync */}
        {fetchedPlans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">3</span>
                Sync to Database
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Plans not in the API will be deactivated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={syncSelectedPlans} 
                disabled={syncing || selectedPlans.size === 0}
                size="lg"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Sync {selectedPlans.size} Plans to Database
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
