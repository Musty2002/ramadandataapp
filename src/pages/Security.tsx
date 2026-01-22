import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Lock, Fingerprint, Shield, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { TransactionPinDialog, isTransactionPinSetup, clearTransactionPin } from '@/components/auth/TransactionPinDialog';
import { AppLockSetupDialog, isAppLockPinSetup, disableAppLock as disableAppLockFn } from '@/components/auth/AppLockSetupDialog';
import { isAppLockEnabled } from '@/components/auth/AppLockScreen';

export default function Security() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [transactionPinSetup, setTransactionPinSetup] = useState(isTransactionPinSetup());
  const [appLockSetup, setAppLockSetup] = useState(isAppLockPinSetup());
  const [appLockEnabled, setAppLockEnabled] = useState(isAppLockEnabled());
  const [biometricEnabled, setBiometricEnabled] = useState(
    localStorage.getItem('biometric_enabled') === 'true'
  );
  
  const [showTransactionPinDialog, setShowTransactionPinDialog] = useState(false);
  const [showAppLockDialog, setShowAppLockDialog] = useState(false);
  const [transactionPinMode, setTransactionPinMode] = useState<'setup' | 'change'>('setup');

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

  const handleAppLockToggle = () => {
    if (appLockSetup) {
      disableAppLockFn();
      setAppLockSetup(false);
      setAppLockEnabled(false);
      toast({
        title: 'App Lock Disabled',
        description: 'Your app lock PIN has been removed.',
      });
    } else {
      setShowAppLockDialog(true);
    }
  };

  const handleBiometricToggle = (enabled: boolean) => {
    if (enabled) {
      localStorage.setItem('biometric_enabled', 'true');
      setBiometricEnabled(true);
      toast({
        title: 'Biometric Enabled',
        description: 'You can now use fingerprint/face to unlock the app.',
      });
    } else {
      localStorage.removeItem('biometric_enabled');
      setBiometricEnabled(false);
      toast({
        title: 'Biometric Disabled',
        description: 'Biometric authentication has been disabled.',
      });
    }
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

          {/* App Lock PIN */}
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium">App Lock PIN</p>
                  <p className="text-sm text-muted-foreground">6-digit PIN to lock app (mobile only)</p>
                </div>
              </div>
              <Switch 
                checked={appLockSetup} 
                onCheckedChange={handleAppLockToggle}
              />
            </div>
          </div>

          {/* Biometric */}
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Fingerprint className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">Biometric Unlock</p>
                  <p className="text-sm text-muted-foreground">Use fingerprint/face ID (mobile only)</p>
                </div>
              </div>
              <Switch 
                checked={biometricEnabled} 
                onCheckedChange={handleBiometricToggle}
                disabled={!appLockSetup}
              />
            </div>
            {!appLockSetup && (
              <p className="mt-2 text-xs text-muted-foreground">
                Enable App Lock PIN first to use biometric
              </p>
            )}
          </div>

          {/* Security Tips */}
          <div className="bg-muted/50 rounded-xl p-4 mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-primary" />
              <p className="font-medium">Security Tips</p>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Never share your PIN with anyone</li>
              <li>• Use different PINs for app lock and transactions</li>
              <li>• Enable biometric for faster, secure access</li>
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

      {/* App Lock Setup Dialog */}
      <AppLockSetupDialog
        open={showAppLockDialog}
        onOpenChange={setShowAppLockDialog}
        onComplete={() => {
          setAppLockSetup(true);
          setAppLockEnabled(true);
          toast({
            title: 'App Lock Enabled',
            description: 'Your 6-digit app lock PIN has been created.',
          });
        }}
      />
    </MobileLayout>
  );
}
