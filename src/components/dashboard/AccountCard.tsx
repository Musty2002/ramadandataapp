import { useState } from 'react';
import { Eye, EyeOff, Copy, Plus, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export function AccountCard() {
  const { profile, wallet } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const copyAccountNumber = () => {
    if (profile?.account_number) {
      navigator.clipboard.writeText(profile.account_number);
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

  return (
    <div className="gradient-primary rounded-2xl p-5 text-primary-foreground mx-4 shadow-lg">
      {/* Account Info */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-90">{profile?.account_number || '----------'}</span>
          <button onClick={copyAccountNumber} className="p-1 hover:bg-white/10 rounded">
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <span className="text-xs opacity-75">Ramadan Data Sub</span>
      </div>

      {/* User Name */}
      <p className="text-sm opacity-90 mb-1">Hello,</p>
      <h2 className="text-lg font-semibold mb-4">{profile?.full_name || 'User'}</h2>

      {/* Balance */}
      <div className="mb-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">
            {showBalance ? formatBalance(wallet?.balance || 0) : '₦ ****'}
          </span>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="p-1 hover:bg-white/10 rounded"
          >
            {showBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs opacity-75">Last updated just now</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-4">
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