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
import { WhatsAppButton } from '@/components/dashboard/WhatsAppButton';
import { storeUserForPinLogin } from '@/components/auth/PinLoginScreen';
import logo from '@/assets/ramadan-logo.jpeg';

export default function Dashboard() {
  const navigate = useNavigate();
  const { refreshWallet, refreshProfile, profile, user } = useAuth();
  const { toast } = useToast();
  const [refreshTick, setRefreshTick] = useState(0);
  
  // PIN setup states
  const [showTransactionPinSetup, setShowTransactionPinSetup] = useState(false);

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
    </MobileLayout>
  );
}
