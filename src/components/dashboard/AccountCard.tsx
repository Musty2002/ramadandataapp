import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Copy, Plus, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export function AccountCard() {
  const { profile, wallet, user, refreshProfile } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [liveBalance, setLiveBalance] = useState<number>(wallet?.balance || 0);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const { toast } = useToast();
  const navigate = useNavigate();

  // Sync live balance with wallet prop
  useEffect(() => {
    if (wallet?.balance !== undefined) {
      setLiveBalance(wallet.balance);
    }
  }, [wallet?.balance]);

  // Auto-create virtual account if not exists
  useEffect(() => {
    if (!user?.id || !profile) return;
    
    // If no virtual account, start creation
    if (!profile.virtual_account_number && !creatingAccount && retryCountRef.current < maxRetries) {
      createVirtualAccount();
    }
  }, [user?.id, profile?.virtual_account_number]);

  const createVirtualAccount = async () => {
    if (creatingAccount) return;
    
    setCreatingAccount(true);
    retryCountRef.current += 1;
    
    try {
      const response = await supabase.functions.invoke('create-virtual-account');
      
      if (response.error) {
        console.error('Virtual account creation failed:', response.error);
        
        // Retry after delay if under max retries
        if (retryCountRef.current < maxRetries) {
          setTimeout(() => {
            setCreatingAccount(false);
          }, 5000 * retryCountRef.current); // Exponential backoff: 5s, 10s, 15s
        } else {
          toast({
            variant: 'destructive',
            title: 'Account Setup Failed',
            description: 'Unable to create virtual account. Please try again from Add Money page.',
          });
          setCreatingAccount(false);
        }
      } else {
        // Success - refresh profile to get new account details
        await refreshProfile?.();
        setCreatingAccount(false);
        retryCountRef.current = 0;
      }
    } catch (err) {
      console.error('Error creating virtual account:', err);
      
      if (retryCountRef.current < maxRetries) {
        setTimeout(() => {
          setCreatingAccount(false);
        }, 5000 * retryCountRef.current);
      } else {
        setCreatingAccount(false);
      }
    }
  };

  // Subscribe to realtime wallet updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('wallet-balance')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && payload.new.balance !== undefined) {
            const nextBalance = Number((payload.new as any).balance);
            if (Number.isFinite(nextBalance)) setLiveBalance(nextBalance);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Subscribe to profile updates (for virtual account creation)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('profile-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshProfile?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshProfile]);

  const copyAccountNumber = () => {
    const accountNumber = profile?.virtual_account_number;
    if (accountNumber) {
      navigator.clipboard.writeText(accountNumber);
      toast({
        title: 'Copied!',
        description: 'Account number copied to clipboard',
      });
    }
  };

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(balance);
  };

  const hasVirtualAccount = !!profile?.virtual_account_number;
  const isLoading = !hasVirtualAccount && (creatingAccount || retryCountRef.current < maxRetries);
  const displayName = profile?.full_name || 'User';

  return (
    <div className="gradient-primary rounded-2xl p-5 text-primary-foreground mx-4 shadow-lg">
      {/* Greeting & Name */}
      <div className="mb-4">
        <p className="text-sm opacity-80">Hello,</p>
        <h2 className="text-xl font-semibold">{displayName}</h2>
      </div>

      {/* Balance Section */}
      <div className="mb-4">
        <p className="text-xs opacity-70 mb-1">Available Balance</p>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold">
            {showBalance ? formatBalance(liveBalance) : '₦ ****'}
          </span>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            {showBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Account Details */}
      <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 mb-4">
        {isLoading ? (
          <div className="flex-1 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <div>
              <p className="text-xs opacity-70">Setting up your account...</p>
              <p className="text-sm font-medium">Creating virtual bank account</p>
            </div>
          </div>
        ) : hasVirtualAccount ? (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-xs opacity-70">{profile.virtual_account_bank}</p>
              <p className="text-sm font-medium truncate">{profile.virtual_account_number}</p>
            </div>
            <button 
              onClick={copyAccountNumber} 
              className="p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
              title="Copy account number"
            >
              <Copy className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex-1">
            <p className="text-xs opacity-70">Account setup failed</p>
            <button 
              onClick={() => { retryCountRef.current = 0; createVirtualAccount(); }}
              className="text-sm font-medium underline"
            >
              Tap to retry
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0"
          onClick={() => navigate('/add-money')}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Money
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0"
          onClick={() => navigate('/history')}
        >
          <History className="w-4 h-4 mr-1" />
          History
        </Button>
      </div>
    </div>
  );
}
