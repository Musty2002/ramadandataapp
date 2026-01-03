import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const providers = [
  { id: 'aedc', name: 'AEDC - Abuja' },
  { id: 'ekedc', name: 'EKEDC - Eko' },
  { id: 'ikedc', name: 'IKEDC - Ikeja' },
  { id: 'ibedc', name: 'IBEDC - Ibadan' },
  { id: 'phed', name: 'PHED - Port Harcourt' },
  { id: 'kedco', name: 'KEDCO - Kano' },
  { id: 'jedc', name: 'JEDC - Jos' },
  { id: 'bedc', name: 'BEDC - Benin' },
];

export default function Electricity() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [provider, setProvider] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [meterType, setMeterType] = useState('prepaid');

  const handlePurchase = () => {
    if (!provider || !meterNumber || !amount) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill in all fields',
      });
      return;
    }

    toast({
      title: 'Coming Soon',
      description: 'Electricity payment will be available soon',
    });
  };

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Electricity Bill</h1>
        </div>

        <div className="px-4 pb-6">
          {/* Provider Selection */}
          <div className="mb-6">
            <Label>Select Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select electricity provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meter Type */}
          <div className="mb-6">
            <Label className="mb-3 block">Meter Type</Label>
            <div className="flex gap-3">
              <button
                onClick={() => setMeterType('prepaid')}
                className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                  meterType === 'prepaid'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                <p className="font-medium">Prepaid</p>
              </button>
              <button
                onClick={() => setMeterType('postpaid')}
                className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                  meterType === 'postpaid'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                <p className="font-medium">Postpaid</p>
              </button>
            </div>
          </div>

          {/* Meter Number */}
          <div className="mb-6">
            <Label htmlFor="meter">Meter Number</Label>
            <Input
              id="meter"
              placeholder="Enter meter number"
              value={meterNumber}
              onChange={(e) => setMeterNumber(e.target.value)}
              className="mt-2"
            />
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

          {/* Pay Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handlePurchase}
            disabled={!provider || !meterNumber || !amount}
          >
            Pay Bill
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}