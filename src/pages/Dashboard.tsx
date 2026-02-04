import { useState, useEffect, useCallback } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { AccountCard } from '@/components/dashboard/AccountCard';
import { ServicesGrid } from '@/components/dashboard/ServicesGrid';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { Bell, RefreshCw, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { TransactionPinDialog, isTransactionPinSetup } from '@/components/auth/TransactionPinDialog';
import { WhatsAppButton } from '@/components/dashboard/WhatsAppButton';
import { storeUserForPinLogin } from '@/components/auth/PinLoginScreen';
import { Button } from '@/components/ui/button';
import { useConnectionTimeout } from '@/hooks/useConnectionTimeout';
import { ConnectionTimeoutOverlay } from '@/components/NetworkStatus';
import logo from '@/assets/ramadan-logo.jpeg';
import { useDocumentVisibility } from '@/hooks/useDocumentVisibility';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function Dashboard() {
  const navigate = useNavigate();
  const { refreshWallet, refreshProfile, profile, user, dataLoading, dataError, retryDataFetch } = useAuth();
  const { toast } = useToast();
  const [refreshTick, setRefreshTick] = useState(0);
  
  // PIN setup states
  const [showTransactionPinSetup, setShowTransactionPinSetup] = useState(false);

  const { isVisible } = useDocumentVisibility();

  // Connection timeout detection - dataLoading comes from useAuth
  const { isTimedOut, resetTimeout } = useConnectionTimeout(dataLoading, {
    timeout: 15000,
    enabled: isVisible,
  });

  const handleTimeoutRetry = useCallback(() => {
    resetTimeout();
    retryDataFetch();
  }, [resetTimeout, retryDataFetch]);

  // Check if transaction PIN needs to be set up on first load
  useEffect(() => {
    const checkPinSetup = () => {
      if (!isTransactionPinSetup()) {
        setTimeout(() => setShowTransactionPinSetup(true), 1000);
      }
    };

    checkPinSetup();
  }, []);

  // Store user info for PIN login when profile is available
  useEffect(() => {
    if (profile && user?.email) {
      storeUserForPinLogin(
        user.email,
        profile.full_name,
        profile.avatar_url || undefined
      );
    }
  }, [profile, user]);

  const handleTransactionPinComplete = () => {
    toast({
      title: 'Transaction PIN Set',
      description: 'Your 4-digit PIN has been created for login and transactions.',
    });
    setShowTransactionPinSetup(false);
  };

  const handleRefresh = async () => {
    await Promise.all([refreshWallet(), refreshProfile()]);
    setRefreshTick((t) => t + 1);
    toast({
      title: 'Refreshed',
      description: 'Your data has been updated',
    });
  };

  const handleRetry = () => {
    retryDataFetch();
    setRefreshTick((t) => t + 1);
  };

  return (
    <MobileLayout>
      <PullToRefresh onRefresh={handleRefresh} className="h-full">
        <div className="safe-area-top">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4">
            <div 
              className="h-11 w-11 rounded-full p-0.5 bg-gradient-to-br from-primary via-primary/80 to-primary/60 cursor-pointer shadow-md"
              onClick={() => navigate('/profile')}
            >
              <Avatar className="h-full w-full border-2 border-background">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {profile?.full_name ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
            <h1 className="text-lg font-bold text-primary">Ramadan Data App</h1>
            <button 
              onClick={() => navigate('/notifications')}
              className="relative w-10 h-10 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              <Bell className="w-5 h-5 text-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>

          {/* Error state with retry */}
          {dataError && !dataLoading && (
            <div className="mx-4 mb-4 p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-3 mb-3">
                <WifiOff className="w-5 h-5 text-destructive" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">Connection Issue</p>
                  <p className="text-sm text-muted-foreground">
                    {dataError.includes('timed out') 
                      ? 'Request took too long. Please check your connection.'
                      : dataError}
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleRetry} 
                size="sm" 
                variant="outline"
                className="w-full"
                disabled={dataLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${dataLoading ? 'animate-spin' : ''}`} />
                Try Again
              </Button>
            </div>
          )}

          {/* Account Card */}
          <AccountCard />

          {/* Services Grid */}
          <ServicesGrid />

          {/* Recent Transactions */}
          <RecentTransactions refreshTick={refreshTick} />
        </div>
      </PullToRefresh>

      {/* WhatsApp Button */}
      <WhatsAppButton />

      {/* Transaction PIN Setup Dialog (4-digit) - Used for both login and transactions */}
      <TransactionPinDialog
        open={showTransactionPinSetup}
        onOpenChange={setShowTransactionPinSetup}
        onComplete={handleTransactionPinComplete}
        mode="setup"
        title="Set Your PIN"
        description="Create a 4-digit PIN for quick login and transaction authorization"
      />

      {/* Connection Timeout Overlay - safety net for stuck loading */}
      <ConnectionTimeoutOverlay
        isVisible={isTimedOut && !dataError}
        onRetry={handleTimeoutRetry}
        message="Taking too long"
      />
    </MobileLayout>
  );
}
