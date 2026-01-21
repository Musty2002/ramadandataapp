import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, RefreshCw, Loader2, Edit, Plus } from 'lucide-react';

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

export default function AdminDataPlans() {
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [networkFilter, setNetworkFilter] = useState<string>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [editForm, setEditForm] = useState({ selling_price: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_plans')
        .select('*')
        .order('network', { ascending: true })
        .order('selling_price', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
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

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleEdit = (plan: DataPlan) => {
    setSelectedPlan(plan);
    setEditForm({
      selling_price: plan.selling_price.toString(),
      is_active: plan.is_active,
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedPlan) return;

    const price = parseFloat(editForm.selling_price);
    if (isNaN(price) || price < 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Price',
        description: 'Please enter a valid price',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('data_plans')
        .update({
          selling_price: price,
          is_active: editForm.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPlan.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Data plan updated successfully',
      });

      setEditDialogOpen(false);
      fetchPlans();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update plan',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkPriceUpdate = async (percentage: number) => {
    const confirmed = window.confirm(
      `Are you sure you want to ${percentage > 0 ? 'increase' : 'decrease'} all prices by ${Math.abs(percentage)}%?`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      for (const plan of plans) {
        const newPrice = Math.round(plan.selling_price * (1 + percentage / 100));
        await supabase
          .from('data_plans')
          .update({ selling_price: newPrice, updated_at: new Date().toISOString() })
          .eq('id', plan.id);
      }

      toast({
        title: 'Success',
        description: `All prices ${percentage > 0 ? 'increased' : 'decreased'} by ${Math.abs(percentage)}%`,
      });

      fetchPlans();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update prices',
      });
    } finally {
      setLoading(false);
    }
  };

  const networks = [...new Set(plans.map((p) => p.network))];

  const filteredPlans = plans.filter((plan) => {
    const matchesSearch =
      plan.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.network.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesNetwork = networkFilter === 'all' || plan.network.toLowerCase() === networkFilter;

    return matchesSearch && matchesNetwork;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Data Plans</h1>
            <p className="text-muted-foreground">Manage data plan prices and availability</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleBulkPriceUpdate(5)}>
              +5%
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkPriceUpdate(-5)}>
              -5%
            </Button>
            <Button variant="outline" onClick={fetchPlans} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search plans..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={networkFilter} onValueChange={setNetworkFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by network" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Networks</SelectItem>
                  {networks.map((network) => (
                    <SelectItem key={network} value={network.toLowerCase()}>
                      {network.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Network</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Validity</TableHead>
                      <TableHead>API Price</TableHead>
                      <TableHead>Selling Price</TableHead>
                      <TableHead>Margin</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          No data plans found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPlans.map((plan) => {
                        const margin = plan.selling_price - plan.api_price;
                        const marginPercent = ((margin / plan.api_price) * 100).toFixed(1);
                        return (
                          <TableRow key={plan.id}>
                            <TableCell>
                              <Badge variant="outline">{plan.network.toUpperCase()}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{plan.display_name}</TableCell>
                            <TableCell className="capitalize">{plan.category}</TableCell>
                            <TableCell>{plan.data_amount || '-'}</TableCell>
                            <TableCell>{plan.validity || '-'}</TableCell>
                            <TableCell>₦{plan.api_price.toLocaleString()}</TableCell>
                            <TableCell className="font-medium">₦{plan.selling_price.toLocaleString()}</TableCell>
                            <TableCell>
                              <span className={margin >= 0 ? 'text-green-600' : 'text-red-600'}>
                                ₦{margin.toLocaleString()} ({marginPercent}%)
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className={plan.is_active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}>
                                {plan.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(plan)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Data Plan</DialogTitle>
            <DialogDescription>
              Update pricing for {selectedPlan?.display_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>API Price (Cost)</Label>
              <Input value={`₦${selectedPlan?.api_price.toLocaleString()}`} disabled />
            </div>
            <div className="space-y-2">
              <Label>Selling Price (₦)</Label>
              <Input
                type="number"
                value={editForm.selling_price}
                onChange={(e) => setEditForm({ ...editForm, selling_price: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
