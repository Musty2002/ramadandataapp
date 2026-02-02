import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, X, Settings2, Users, Gift, Clock } from 'lucide-react';
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

interface ReferralSettings {
  id: string;
  min_funding_amount: number;
  referrer_bonus: number;
  is_enabled: boolean;
  requires_approval: boolean;
}

interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string;
  status: 'pending' | 'completed' | 'bonus_paid';
  referrer_bonus: number;
  referee_bonus: number;
  funding_amount: number | null;
  funding_triggered_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  bonus_paid_at: string | null;
  created_at: string;
  referrer?: { full_name: string; email: string };
  referee?: { full_name: string; email: string };
}

export default function AdminReferrals() {
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Form state for settings
  const [formMinFunding, setFormMinFunding] = useState(1000);
  const [formReferrerBonus, setFormReferrerBonus] = useState(50);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formRequiresApproval, setFormRequiresApproval] = useState(true);

  const fetchData = async () => {
    try {
      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('referral_settings')
        .select('*')
        .limit(1)
        .single();

      if (settingsError) throw settingsError;
      setSettings(settingsData);
      setFormMinFunding(settingsData.min_funding_amount);
      setFormReferrerBonus(settingsData.referrer_bonus);
      setFormEnabled(settingsData.is_enabled);
      setFormRequiresApproval(settingsData.requires_approval);

      // Fetch referrals with profile info via admin-data function
      const { data: referralsData, error: referralsError } = await supabase.functions.invoke('admin-data', {
        body: { action: 'get_referrals' }
      });

      if (referralsError) throw referralsError;
      setReferrals(referralsData?.referrals || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);

    try {
      const { error } = await supabase
        .from('referral_settings')
        .update({
          min_funding_amount: formMinFunding,
          referrer_bonus: formReferrerBonus,
          is_enabled: formEnabled,
          requires_approval: formRequiresApproval,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);

      if (error) throw error;

      setSettings({
        ...settings,
        min_funding_amount: formMinFunding,
        referrer_bonus: formReferrerBonus,
        is_enabled: formEnabled,
        requires_approval: formRequiresApproval,
      });

      toast.success('Settings saved successfully');
      setSettingsOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleApproveReferral = async (referral: Referral) => {
    setProcessingId(referral.id);

    try {
      const { error } = await supabase.functions.invoke('admin-data', {
        body: { 
          action: 'approve_referral',
          referral_id: referral.id 
        }
      });

      if (error) throw error;

      toast.success('Referral bonus approved and paid!');
      fetchData();
    } catch (error) {
      console.error('Error approving referral:', error);
      toast.error('Failed to approve referral');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectReferral = async (referral: Referral) => {
    setProcessingId(referral.id);

    try {
      const { error } = await supabase.functions.invoke('admin-data', {
        body: { 
          action: 'reject_referral',
          referral_id: referral.id 
        }
      });

      if (error) throw error;

      toast.success('Referral rejected');
      fetchData();
    } catch (error) {
      console.error('Error rejecting referral:', error);
      toast.error('Failed to reject referral');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string, fundingTriggered: boolean) => {
    if (status === 'bonus_paid') {
      return <Badge className="bg-green-500">Paid</Badge>;
    }
    if (status === 'completed' && fundingTriggered) {
      return <Badge className="bg-yellow-500">Awaiting Approval</Badge>;
    }
    if (fundingTriggered) {
      return <Badge className="bg-blue-500">Funded</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const pendingApprovalCount = referrals.filter(
    r => r.status === 'completed' && r.funding_triggered_at && !r.approved_at
  ).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Referrals</h1>
            <p className="text-muted-foreground">Manage referral program and approvals</p>
          </div>
          <Button onClick={() => setSettingsOpen(true)} variant="outline">
            <Settings2 className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Referrals
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{referrals.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Approval
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{pendingApprovalCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Bonus Amount
              </CardTitle>
              <Gift className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{settings?.referrer_bonus || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={settings?.is_enabled ? 'bg-green-500' : 'bg-red-500'}>
                {settings?.is_enabled ? 'Active' : 'Disabled'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Referrals Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : referrals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No referrals yet</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referrer</TableHead>
                      <TableHead>Referee</TableHead>
                      <TableHead>Funding</TableHead>
                      <TableHead>Bonus</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((referral) => {
                      const canApprove = referral.funding_triggered_at && 
                        referral.status !== 'bonus_paid' && 
                        !referral.approved_at;
                      
                      return (
                        <TableRow key={referral.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{referral.referrer?.full_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{referral.referrer?.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{referral.referee?.full_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{referral.referee?.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {referral.funding_amount 
                              ? `₦${Number(referral.funding_amount).toLocaleString()}` 
                              : '-'}
                          </TableCell>
                          <TableCell>₦{Number(referral.referrer_bonus).toLocaleString()}</TableCell>
                          <TableCell>
                            {getStatusBadge(referral.status, !!referral.funding_triggered_at)}
                          </TableCell>
                          <TableCell>
                            {new Date(referral.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {canApprove ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-500 hover:bg-green-600"
                                  onClick={() => handleApproveReferral(referral)}
                                  disabled={processingId === referral.id}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRejectReferral(referral)}
                                  disabled={processingId === referral.id}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : referral.status === 'bonus_paid' ? (
                              <span className="text-xs text-green-600">
                                Paid {referral.bonus_paid_at ? new Date(referral.bonus_paid_at).toLocaleDateString() : ''}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Waiting for funding</span>
                            )}
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
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Referral Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Referral Program</Label>
                <p className="text-xs text-muted-foreground">Turn the referral program on or off</p>
              </div>
              <Switch
                checked={formEnabled}
                onCheckedChange={setFormEnabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Require Admin Approval</Label>
                <p className="text-xs text-muted-foreground">Manually approve each bonus payment</p>
              </div>
              <Switch
                checked={formRequiresApproval}
                onCheckedChange={setFormRequiresApproval}
              />
            </div>

            <div className="space-y-2">
              <Label>Minimum Funding Amount (₦)</Label>
              <Input
                type="number"
                value={formMinFunding}
                onChange={(e) => setFormMinFunding(Number(e.target.value))}
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Referee must fund at least this amount to trigger bonus
              </p>
            </div>

            <div className="space-y-2">
              <Label>Referrer Bonus (₦)</Label>
              <Input
                type="number"
                value={formReferrerBonus}
                onChange={(e) => setFormReferrerBonus(Number(e.target.value))}
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Amount the referrer receives when approved
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}