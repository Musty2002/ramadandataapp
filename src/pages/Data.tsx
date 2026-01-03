import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Check } from 'lucide-react';
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

const dataBundles = [
  { id: '1', data: '500MB', validity: '30 days', price: 150 },
  { id: '2', data: '1GB', validity: '30 days', price: 250 },
  { id: '3', data: '2GB', validity: '30 days', price: 500 },
  { id: '4', data: '3GB', validity: '30 days', price: 750 },
  { id: '5', data: '5GB', validity: '30 days', price: 1200 },
  { id: '6', data: '10GB', validity: '30 days', price: 2500 },
];

export default function Data() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');

  const handlePurchase = () => {
    if (!selectedNetwork || !selectedBundle || !phoneNumber) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill in all fields',
      });
      return;
    }

    toast({
      title: 'Coming Soon',
      description: 'Data purchase will be available soon',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
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
          <h1 className="text-lg font-bold text-foreground">Buy Data</h1>
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

          {/* Data Bundles */}
          <div className="mb-6">
            <Label className="mb-3 block">Select Data Bundle</Label>
            <div className="grid grid-cols-2 gap-3">
              {dataBundles.map((bundle) => (
                <button
                  key={bundle.id}
                  onClick={() => setSelectedBundle(bundle.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                    selectedBundle === bundle.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card'
                  }`}
                >
                  {selectedBundle === bundle.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  <p className="text-lg font-bold text-foreground">{bundle.data}</p>
                  <p className="text-xs text-muted-foreground">{bundle.validity}</p>
                  <p className="text-sm font-semibold text-primary mt-2">
                    {formatPrice(bundle.price)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Purchase Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handlePurchase}
            disabled={!selectedNetwork || !selectedBundle || !phoneNumber}
          >
            Buy Data
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}