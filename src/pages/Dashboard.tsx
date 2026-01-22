import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { AccountCard } from '@/components/dashboard/AccountCard';
import { ServicesGrid } from '@/components/dashboard/ServicesGrid';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { TransactionPinDialog, isTransactionPinSetup } from '@/components/auth/TransactionPinDialog';
import { AppLockSetupDialog, isAppLockPinSetup } from '@/components/auth/AppLockSetupDialog';
import logo from '@/assets/ramadan-logo.jpeg';

export default function Dashboard() {
  const navigate = useNavigate();
  const { refreshWallet, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [refreshTick, setRefreshTick] = useState(0);
  
  // PIN setup states
  const [showAppLockSetup, setShowAppLockSetup] = useState(false);
  const [showTransactionPinSetup, setShowTransactionPinSetup] = useState(false);

  // Check if PINs need to be set up on first load
  useEffect(() => {
    const checkPinSetup = () => {
      // First check app lock PIN (6-digit)
      if (!isAppLockPinSetup()) {
        setTimeout(() => setShowAppLockSetup(true), 1000);
      } else if (!isTransactionPinSetup()) {
        // Then check transaction PIN (4-digit)
        setTimeout(() => setShowTransactionPinSetup(true), 1000);
      }
    };

    checkPinSetup();
  }, []);

  const handleAppLockComplete = () => {
    toast({
      title: 'App Lock PIN Set',
      description: 'Your 6-digit app lock PIN has been created.',
    });
    setShowAppLockSetup(false);
    
    // Now check if transaction PIN needs setup
    if (!isTransactionPinSetup()) {
      setTimeout(() => setShowTransactionPinSetup(true), 500);
    }
  };

  const handleTransactionPinComplete = () => {
    toast({
      title: 'Transaction PIN Set',
      description: 'Your 4-digit transaction PIN has been created.',
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

  return (
    <MobileLayout>
      <PullToRefresh onRefresh={handleRefresh} className="h-full">
        <div className="safe-area-top">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4">
            <img src={logo} alt="Ramadan Data App" className="h-10 w-10 rounded-full object-cover" />
            <h1 className="text-lg font-bold text-primary">Ramadan Data App</h1>
            <button 
              onClick={() => navigate('/notifications')}
              className="relative w-10 h-10 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              <Bell className="w-5 h-5 text-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>

          {/* Account Card */}
          <AccountCard />

          {/* Services Grid */}
          <ServicesGrid />

          {/* Recent Transactions */}
          <RecentTransactions refreshTick={refreshTick} />
        </div>
      </PullToRefresh>

      {/* App Lock PIN Setup Dialog (6-digit) */}
      <AppLockSetupDialog
        open={showAppLockSetup}
        onOpenChange={setShowAppLockSetup}
        onComplete={handleAppLockComplete}
      />

      {/* Transaction PIN Setup Dialog (4-digit) */}
      <TransactionPinDialog
        open={showTransactionPinSetup}
        onOpenChange={setShowTransactionPinSetup}
        onComplete={handleTransactionPinComplete}
        mode="setup"
        title="Set Transaction PIN"
        description="Create a 4-digit PIN to authorize your transactions"
      />
    </MobileLayout>
  );
}
