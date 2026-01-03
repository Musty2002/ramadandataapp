import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function Transfer() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useAuth();
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [recipientName, setRecipientName] = useState('');

  const handleLookup = () => {
    if (!accountNumber || accountNumber.length < 10) {
      toast({
        variant: 'destructive',
        title: 'Invalid Account',
        description: 'Please enter a valid account number',
      });
      return;
    }
    // Mock lookup - in real app, would query the database
    setRecipientName('John Doe');
    toast({
      title: 'Account Found',
      description: 'Recipient verified successfully',
    });
  };

  const handleTransfer = () => {
    if (!accountNumber || !amount || !recipientName) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill in all fields',
      });
      return;
    }

    const transferAmount = parseFloat(amount);
    if (transferAmount > (wallet?.balance || 0)) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Balance',
        description: 'You do not have enough funds for this transfer',
      });
      return;
    }

    toast({
      title: 'Coming Soon',
      description: 'Transfer feature will be available soon',
    });
  };

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(balance);
  };

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Transfer Money</h1>
        </div>

        <div className="px-4 pb-6">
          {/* Balance Card */}
          <div className="bg-card rounded-xl p-4 mb-6 shadow-sm">
            <p className="text-sm text-muted-foreground">Available Balance</p>
            <p className="text-2xl font-bold text-foreground">
              {formatBalance(wallet?.balance || 0)}
            </p>
          </div>

          {/* Account Number */}
          <div className="mb-6">
            <Label htmlFor="account">Recipient Account Number</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="account"
                placeholder="Enter account number"
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value);
                  setRecipientName('');
                }}
                className="flex-1"
              />
              <Button variant="outline" onClick={handleLookup}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
            {recipientName && (
              <p className="text-sm text-green-600 mt-2">✓ {recipientName}</p>
            )}
          </div>

          {/* Amount */}
          <div className="mb-6">
            <Label htmlFor="amount">Amount (₦)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* Transfer Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleTransfer}
            disabled={!accountNumber || !amount || !recipientName}
          >
            Send Money
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}