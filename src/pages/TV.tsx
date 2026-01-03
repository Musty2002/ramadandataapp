import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const providers = [
  { id: 'dstv', name: 'DSTV', color: 'bg-blue-600' },
  { id: 'gotv', name: 'GOtv', color: 'bg-green-600' },
  { id: 'startimes', name: 'StarTimes', color: 'bg-orange-500' },
];

const packages: Record<string, { id: string; name: string; price: number }[]> = {
  dstv: [
    { id: 'padi', name: 'Padi', price: 2150 },
    { id: 'yanga', name: 'Yanga', price: 3500 },
    { id: 'confam', name: 'Confam', price: 6200 },
    { id: 'compact', name: 'Compact', price: 10500 },
    { id: 'compact_plus', name: 'Compact Plus', price: 16600 },
    { id: 'premium', name: 'Premium', price: 24500 },
  ],
  gotv: [
    { id: 'smallie', name: 'Smallie', price: 1100 },
    { id: 'jinja', name: 'Jinja', price: 2250 },
    { id: 'jolli', name: 'Jolli', price: 3300 },
    { id: 'max', name: 'Max', price: 5000 },
    { id: 'supa', name: 'Supa', price: 6400 },
  ],
  startimes: [
    { id: 'nova', name: 'Nova', price: 900 },
    { id: 'basic', name: 'Basic', price: 1850 },
    { id: 'smart', name: 'Smart', price: 2600 },
    { id: 'classic', name: 'Classic', price: 2750 },
    { id: 'super', name: 'Super', price: 4900 },
  ],
};

export default function TV() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [smartCardNumber, setSmartCardNumber] = useState('');

  const handlePurchase = () => {
    if (!selectedProvider || !selectedPackage || !smartCardNumber) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill in all fields',
      });
      return;
    }

    toast({
      title: 'Coming Soon',
      description: 'TV subscription will be available soon',
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
          <h1 className="text-lg font-bold text-foreground">TV Subscription</h1>
        </div>

        <div className="px-4 pb-6">
          {/* Provider Selection */}
          <div className="mb-6">
            <Label className="mb-3 block">Select Provider</Label>
            <div className="grid grid-cols-3 gap-3">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => {
                    setSelectedProvider(provider.id);
                    setSelectedPackage(null);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedProvider === provider.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full ${provider.color} mx-auto mb-2`} />
                  <p className="text-sm font-medium text-center">{provider.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Smart Card Number */}
          <div className="mb-6">
            <Label htmlFor="smartcard">Smart Card / IUC Number</Label>
            <Input
              id="smartcard"
              placeholder="Enter smart card number"
              value={smartCardNumber}
              onChange={(e) => setSmartCardNumber(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* Package Selection */}
          {selectedProvider && (
            <div className="mb-6">
              <Label className="mb-3 block">Select Package</Label>
              <div className="space-y-2">
                {packages[selectedProvider]?.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg.id)}
                    className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                      selectedPackage === pkg.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-medium text-foreground">{pkg.name}</p>
                      <p className="text-sm text-primary font-semibold">{formatPrice(pkg.price)}</p>
                    </div>
                    {selectedPackage === pkg.id && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subscribe Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handlePurchase}
            disabled={!selectedProvider || !selectedPackage || !smartCardNumber}
          >
            Subscribe
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}