import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Copy, Building2, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function AddMoney() {
  const navigate = useNavigate();
  const { profile, refreshProfile, user } = useAuth();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh profile on mount to get latest data
  useEffect(() => {
    if (user) {
      refreshProfile();
    }
  }, [user]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfile();
    setIsRefreshing(false);
    toast({
      title: 'Refreshed',
      description: 'Account details updated',
    });
  };

  const createVirtualAccount = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'Please log in to create a virtual account',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-virtual-account', {
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

      console.log('Create virtual account response:', response);

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.success) {
        toast({
          title: 'Success!',
          description: 'Your virtual account has been created',
        });
        // Refresh profile to get the new virtual account details
        await refreshProfile();
      } else if (response.data?.error) {
        throw new Error(response.data.error);
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (error: any) {
      console.error('Error creating virtual account:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create virtual account',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Check if user has virtual account
  const hasVirtualAccount = !!profile?.virtual_account_number;

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Add Money</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="px-4 pb-6">
          {/* Bank Transfer Card */}
          <div className="bg-card rounded-2xl p-6 shadow-sm mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <Building2 className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Bank Transfer</h2>
                <p className="text-sm text-muted-foreground">Transfer to your account</p>
              </div>
            </div>

            {hasVirtualAccount ? (
              <div className="space-y-4">
                <div className="bg-secondary/50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Bank Name</p>
                        <p className="font-semibold text-foreground">
                          {profile?.virtual_account_bank}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!profile?.virtual_account_bank}
                        onClick={() =>
                          copyToClipboard(profile?.virtual_account_bank ?? '', 'Bank name')
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                  </div>
                </div>

                <div className="bg-secondary/50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Account Number</p>
                        <p className="font-semibold text-foreground text-lg tracking-wide">
                          {profile?.virtual_account_number}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!profile?.virtual_account_number}
                        onClick={() =>
                          copyToClipboard(profile?.virtual_account_number ?? '', 'Account number')
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                  </div>
                </div>

                <div className="bg-secondary/50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Account Name</p>
                      <p className="font-semibold text-foreground">
                        {profile?.virtual_account_name || profile?.full_name || 'User'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(profile?.virtual_account_name || profile?.full_name || '', 'Account name')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">
                  Generate your dedicated virtual account to receive payments
                </p>
                <Button 
                  onClick={createVirtualAccount} 
                  disabled={isCreating}
                  className="w-full"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    'Generate Virtual Account'
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-accent/10 rounded-xl p-4">
            <p className="text-sm text-foreground">
              <span className="font-medium">Note:</span> Transfer any amount to the account above.
              Your wallet will be credited automatically within minutes.
            </p>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
