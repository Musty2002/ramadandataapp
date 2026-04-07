import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, Wallet, Loader2, RefreshCw, Ban, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  account_number: string;
  created_at: string;
  wallet_balance?: number;
  is_blocked?: boolean;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [fundDescription, setFundDescription] = useState('');
  const [fundDialogOpen, setFundDialogOpen] = useState(false);
  const [fundingLoading, setFundingLoading] = useState(false);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-data?action=users`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch users');
      }

      setUsers(result.data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to fetch users',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleFundUser = async () => {
    if (!selectedUser || !fundAmount) return;

    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount',
      });
      return;
    }

    setFundingLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-data?action=fund-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: selectedUser.user_id,
            amount,
            description: fundDescription || 'Manual funding by admin',
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fund user');
      }

      toast({
        title: 'Success',
        description: `Successfully funded ₦${amount.toLocaleString()} to ${selectedUser.full_name}`,
      });

      setFundDialogOpen(false);
      setFundAmount('');
      setFundDescription('');
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to fund user',
      });
    } finally {
      setFundingLoading(false);
    }
  };

  const handleToggleBlock = async (user: User) => {
    const newBlocked = !user.is_blocked;
    setBlockingUserId(user.user_id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-data?action=toggle-block-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: user.user_id, is_blocked: newBlocked }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update');

      toast({
        title: newBlocked ? 'User Blocked' : 'User Unblocked',
        description: `${user.full_name} has been ${newBlocked ? 'blocked' : 'unblocked'}`,
      });

      setUsers(prev => prev.map(u => u.user_id === user.user_id ? { ...u, is_blocked: newBlocked } : u));
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setBlockingUserId(null);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.phone.includes(searchQuery) ||
    user.account_number.includes(searchQuery)
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Users</h1>
            <p className="text-muted-foreground">Manage platform users</p>
          </div>
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone, or account number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
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
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Account No.</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id} className={user.is_blocked ? 'opacity-60 bg-destructive/5' : ''}>
                          <TableCell className="font-medium">
                            {user.full_name}
                            {user.is_blocked && (
                              <span className="ml-2 text-xs text-destructive font-semibold">BLOCKED</span>
                            )}
                          </TableCell>
                          <TableCell>{user.email || '-'}</TableCell>
                          <TableCell>{user.phone}</TableCell>
                          <TableCell>{user.account_number}</TableCell>
                          <TableCell>₦{Number(user.wallet_balance).toLocaleString()}</TableCell>
                          <TableCell>{format(new Date(user.created_at), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setFundDialogOpen(true);
                                }}
                              >
                                <Wallet className="h-4 w-4 mr-1" />
                                Fund
                              </Button>
                              <Button
                                size="sm"
                                variant={user.is_blocked ? 'outline' : 'destructive'}
                                disabled={blockingUserId === user.user_id}
                                onClick={() => handleToggleBlock(user)}
                              >
                                {blockingUserId === user.user_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : user.is_blocked ? (
                                  <><CheckCircle className="h-4 w-4 mr-1" /> Unblock</>
                                ) : (
                                  <><Ban className="h-4 w-4 mr-1" /> Block</>
                                )}
                              </Button>
                            </div>
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

      {/* Fund User Dialog */}
      <Dialog open={fundDialogOpen} onOpenChange={setFundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fund User Wallet</DialogTitle>
            <DialogDescription>
              Add funds to {selectedUser?.full_name}'s wallet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                placeholder="Reason for funding"
                value={fundDescription}
                onChange={(e) => setFundDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFundDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleFundUser} disabled={fundingLoading || !fundAmount}>
              {fundingLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Fund Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
