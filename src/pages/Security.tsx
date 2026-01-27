import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Lock, Shield, Fingerprint } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { 
  TransactionPinDialog, 
  isTransactionPinSetup, 
  clearTransactionPin,
  isBiometricForTransactionsEnabled,
  setBiometricForTransactions,
} from '@/components/auth/TransactionPinDialog';

export default function Security() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [transactionPinSetup, setTransactionPinSetup] = useState(isTransactionPinSetup());
  const [showTransactionPinDialog, setShowTransactionPinDialog] = useState(false);
  const [transactionPinMode, setTransactionPinMode] = useState<'setup' | 'change'>('setup');
  const [biometricForTransactions, setBiometricForTransactionsState] = useState(isBiometricForTransactionsEnabled());

  const { 
    isAvailable: biometricAvailable, 
    isEnabled: biometricLoginEnabled,
    getBiometricLabel,
    clearCredentials,
    verifyIdentity,
  } = useBiometricAuth();

  // Refresh states on mount
  useEffect(() => {
    setTransactionPinSetup(isTransactionPinSetup());
    setBiometricForTransactionsState(isBiometricForTransactionsEnabled());
  }, []);

  const handleTransactionPinToggle = () => {
    if (transactionPinSetup) {
      clearTransactionPin();
      setTransactionPinSetup(false);
      toast({
        title: 'Transaction PIN Disabled',
        description: 'Your transaction PIN has been removed.',
      });
    } else {
      setTransactionPinMode('setup');
      setShowTransactionPinDialog(true);
    }
  };

  const handleChangeTransactionPin = () => {
    clearTransactionPin();
    setTransactionPinMode('setup');
    setShowTransactionPinDialog(true);
  };

  const handleBiometricForTransactionsToggle = async () => {
    if (biometricForTransactions) {
      // Disable biometric for transactions
      setBiometricForTransactions(false);
      setBiometricForTransactionsState(false);
      toast({
        title: 'Biometric Disabled',
        description: 'You will need to use PIN for transactions.',
      });
    } else {
      // Verify identity first before enabling
      const verified = await verifyIdentity('Verify to enable biometric for transactions');
      if (verified) {
        setBiometricForTransactions(true);
        setBiometricForTransactionsState(true);
        toast({
          title: 'Biometric Enabled',
          description: `You can now use ${getBiometricLabel()} for transactions.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description: 'Biometric verification is required to enable this feature.',
        });
      }
    }
  };

  const handleClearBiometricLogin = async () => {
    await clearCredentials();
    toast({
      title: 'Biometric Login Cleared',
      description: 'You will need to enter your password to sign in.',
    });
  };

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Security</h1>
        </div>

        {/* Security Options */}
        <div className="space-y-4">
          {/* Transaction PIN */}
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Transaction PIN</p>
                  <p className="text-sm text-muted-foreground">4-digit PIN for transactions</p>
                </div>
              </div>
              <Switch 
                checked={transactionPinSetup} 
                onCheckedChange={handleTransactionPinToggle}
              />
            </div>
            {transactionPinSetup && (
              <button
                onClick={handleChangeTransactionPin}
                className="mt-3 text-sm text-primary font-medium"
              >
                Change Transaction PIN
              </button>
            )}
          </div>

          {/* Biometric for Transactions */}
          {biometricAvailable && transactionPinSetup && (
            <div className="bg-card rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Fingerprint className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{getBiometricLabel()} for Payments</p>
                    <p className="text-sm text-muted-foreground">Use instead of PIN for transactions</p>
                  </div>
                </div>
                <Switch 
                  checked={biometricForTransactions} 
                  onCheckedChange={handleBiometricForTransactionsToggle}
                />
              </div>
            </div>
          )}

          {/* Biometric Login (if enabled) */}
          {biometricAvailable && biometricLoginEnabled && (
            <div className="bg-card rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Fingerprint className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">{getBiometricLabel()} Login</p>
                    <p className="text-sm text-muted-foreground">Quick sign-in enabled</p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleClearBiometricLogin}
                className="mt-3 text-sm text-destructive font-medium"
              >
                Remove {getBiometricLabel()} Login
              </button>
            </div>
          )}

          {/* Security Tips */}
          <div className="bg-muted/50 rounded-xl p-4 mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-primary" />
              <p className="font-medium">Security Tips</p>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Never share your PIN with anyone</li>
              <li>• Use a unique PIN that's hard to guess</li>
              <li>• Change your PIN regularly for better security</li>
              {biometricAvailable && (
                <li>• Enable biometric for faster, secure transactions</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Transaction PIN Dialog */}
      <TransactionPinDialog
        open={showTransactionPinDialog}
        onOpenChange={setShowTransactionPinDialog}
        onComplete={() => {
          setTransactionPinSetup(true);
          toast({
            title: 'Transaction PIN Set',
            description: 'Your 4-digit transaction PIN has been created.',
          });
        }}
        mode={transactionPinMode}
      />
    </MobileLayout>
  );
}
