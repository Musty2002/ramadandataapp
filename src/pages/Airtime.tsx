import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const networks = [
  { id: 'mtn', name: 'MTN', color: 'bg-yellow-400' },
  { id: 'airtel', name: 'Airtel', color: 'bg-red-500' },
  { id: 'glo', name: 'Glo', color: 'bg-green-500' },
  { id: '9mobile', name: '9mobile', color: 'bg-green-700' },
];

const quickAmounts = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

export default function Airtime() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');

  const handlePurchase = () => {
    if (!selectedNetwork || !phoneNumber || !amount) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill in all fields',
      });
      return;
    }

    toast({
      title: 'Coming Soon',
      description: 'Airtime purchase will be available soon',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Buy Airtime</h1>
        </div>

        <div className="px-4 pb-6">
          {/* Network Selection */}
          <div className="mb-6">
            <Label className="mb-3 block">Select Network</Label>
            <div className="grid grid-cols-4 gap-3">
              {networks.map((network) => (
                <button
                  key={network.id}
                  onClick={() => setSelectedNetwork(network.id)}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    selectedNetwork === network.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full ${network.color} mx-auto mb-2`} />
                  <p className="text-xs font-medium text-center">{network.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Phone Number */}
          <div className="mb-6">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="08012345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* Amount */}
          <div className="mb-4">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* Quick Amounts */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    amount === amt.toString()
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-foreground'
                  }`}
                >
                  {formatPrice(amt)}
                </button>
              ))}
            </div>
          </div>

          {/* Purchase Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handlePurchase}
            disabled={!selectedNetwork || !phoneNumber || !amount}
          >
            Buy Airtime
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}