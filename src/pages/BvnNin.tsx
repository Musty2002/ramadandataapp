import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, CreditCard, Fingerprint } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function BvnNin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [verificationType, setVerificationType] = useState<'bvn' | 'nin'>('bvn');
  const [number, setNumber] = useState('');

  const handleVerify = () => {
    if (!number || number.length < 11) {
      toast({
        variant: 'destructive',
        title: 'Invalid Number',
        description: `Please enter a valid ${verificationType.toUpperCase()} number`,
      });
      return;
    }

    toast({
      title: 'Coming Soon',
      description: `${verificationType.toUpperCase()} verification will be available soon`,
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
          <h1 className="text-lg font-bold text-foreground">BVN & NIN Verification</h1>
        </div>

        <div className="px-4 pb-6">
          {/* Type Selection */}
          <div className="mb-6">
            <Label className="mb-3 block">Verification Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setVerificationType('bvn');
                  setNumber('');
                }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  verificationType === 'bvn'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                <CreditCard className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="font-medium text-center">BVN</p>
                <p className="text-xs text-muted-foreground text-center">Bank Verification</p>
              </button>
              <button
                onClick={() => {
                  setVerificationType('nin');
                  setNumber('');
                }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  verificationType === 'nin'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                <Fingerprint className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="font-medium text-center">NIN</p>
                <p className="text-xs text-muted-foreground text-center">National ID</p>
              </button>
            </div>
          </div>

          {/* Number Input */}
          <div className="mb-6">
            <Label htmlFor="number">{verificationType.toUpperCase()} Number</Label>
            <Input
              id="number"
              placeholder={`Enter your ${verificationType.toUpperCase()}`}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              maxLength={11}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Enter your 11-digit {verificationType.toUpperCase()} number
            </p>
          </div>

          {/* Verify Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleVerify}
            disabled={!number || number.length < 11}
          >
            Verify {verificationType.toUpperCase()}
          </Button>

          {/* Info */}
          <div className="mt-6 bg-accent/10 rounded-xl p-4">
            <p className="text-sm text-foreground">
              <span className="font-medium">Why verify?</span> Identity verification helps secure
              your account and enables higher transaction limits.
            </p>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}