import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Loader2, Edit } from 'lucide-react';

interface AirtimePlan {
  id: string;
  network: string;
  provider: string;
  discount_percent: number;
  min_amount: number;
  max_amount: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminAirtimePlans() {
  const [plans, setPlans] = useState<AirtimePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<AirtimePlan | null>(null);
  const [editForm, setEditForm] = useState({
    discount_percent: '',
    min_amount: '',
    max_amount: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('airtime_plans')
        .select('*')
        .order('network', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching airtime plans:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch airtime plans',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleEdit = (plan: AirtimePlan) => {
    setSelectedPlan(plan);
    setEditForm({
      discount_percent: plan.discount_percent.toString(),
      min_amount: plan.min_amount.toString(),
      max_amount: plan.max_amount.toString(),
      is_active: plan.is_active,
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedPlan) return;

    const discount = parseFloat(editForm.discount_percent);
    const minAmount = parseFloat(editForm.min_amount);
    const maxAmount = parseFloat(editForm.max_amount);

    if (isNaN(discount) || discount < 0 || discount > 100) {
      toast({
        variant: 'destructive',
        title: 'Invalid Discount',
        description: 'Discount must be between 0 and 100',
      });
      return;
    }

    if (isNaN(minAmount) || minAmount < 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Min Amount',
        description: 'Please enter a valid minimum amount',
      });
      return;
    }

    if (isNaN(maxAmount) || maxAmount < minAmount) {
      toast({
        variant: 'destructive',
        title: 'Invalid Max Amount',
        description: 'Maximum amount must be greater than minimum',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('airtime_plans')
        .update({
          discount_percent: discount,
          min_amount: minAmount,
          max_amount: maxAmount,
          is_active: editForm.is_active,
        })
        .eq('id', selectedPlan.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Airtime plan updated successfully',
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

  const getNetworkColor = (network: string) => {
    switch (network.toLowerCase()) {
      case 'mtn':
        return 'bg-yellow-500/10 text-yellow-600';
      case 'glo':
        return 'bg-green-500/10 text-green-600';
      case 'airtel':
        return 'bg-red-500/10 text-red-600';
      case '9mobile':
        return 'bg-green-700/10 text-green-700';
      default:
        return 'bg-gray-500/10 text-gray-600';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Airtime Plans</h1>
            <p className="text-muted-foreground">Manage airtime discounts and limits</p>
          </div>
          <Button variant="outline" onClick={fetchPlans} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
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
                      <TableHead>Provider</TableHead>
                      <TableHead>Discount %</TableHead>
                      <TableHead>Min Amount</TableHead>
                      <TableHead>Max Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No airtime plans found
                        </TableCell>
                      </TableRow>
                    ) : (
                      plans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell>
                            <Badge className={getNetworkColor(plan.network)}>
                              {plan.network.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{plan.provider}</TableCell>
                          <TableCell>
                            <span className="font-medium text-green-600">{plan.discount_percent}%</span>
                          </TableCell>
                          <TableCell>₦{plan.min_amount.toLocaleString()}</TableCell>
                          <TableCell>₦{plan.max_amount.toLocaleString()}</TableCell>
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
                      ))
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
            <DialogTitle>Edit Airtime Plan</DialogTitle>
            <DialogDescription>
              Update settings for {selectedPlan?.network.toUpperCase()} airtime
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Discount Percentage (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={editForm.discount_percent}
                onChange={(e) => setEditForm({ ...editForm, discount_percent: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Users pay this percentage less than the original amount
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Amount (₦)</Label>
                <Input
                  type="number"
                  value={editForm.min_amount}
                  onChange={(e) => setEditForm({ ...editForm, min_amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Amount (₦)</Label>
                <Input
                  type="number"
                  value={editForm.max_amount}
                  onChange={(e) => setEditForm({ ...editForm, max_amount: e.target.value })}
                />
              </div>
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
