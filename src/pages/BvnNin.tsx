import { useEffect, useRef, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, CreditCard, Fingerprint, Loader2, CheckCircle2, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { TransactionPinDialog, isTransactionPinSetup } from '@/components/auth/TransactionPinDialog';

type IdType = 'bvn' | 'nin';
interface Price { id_type: string; selling_price: number; is_active: boolean }
interface Result {
  verification_type: string;
  identity_number: string;
  personal_details: Record<string, string | null>;
  contact_details: Record<string, string | null>;
  photo: string | null;
}

export default function BvnNin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [verificationType, setVerificationType] = useState<IdType>('bvn');
  const [number, setNumber] = useState('');
  const [prices, setPrices] = useState<Record<string, Price>>({});
  const [pinOpen, setPinOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    supabase.from('verification_prices').select('id_type, selling_price, is_active').then(({ data }) => {
      const map: Record<string, Price> = {};
      (data || []).forEach((p) => (map[p.id_type] = p as Price));
      setPrices(map);
    });
  }, []);

  const price = prices[verificationType];
  const label = verificationType.toUpperCase();

  const start = () => {
    if (number.length !== 11) {
      toast({ variant: 'destructive', title: 'Invalid Number', description: `Enter a valid 11-digit ${label}` });
      return;
    }
    if (price && !price.is_active) {
      toast({ variant: 'destructive', title: 'Unavailable', description: `${label} verification is currently unavailable` });
      return;
    }
    if (isTransactionPinSetup()) setPinOpen(true);
    else runVerify();
  };

  const runVerify = async () => {
    if (lock.current) return;
    lock.current = true;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-identity', {
        body: { id_type: verificationType, id_number: number },
      });
      if (error || !data?.success) {
        let msg = data?.error;
        if (!msg && error && 'context' in error) {
          try { msg = (await (error as any).context.json()).error; } catch { /* ignore */ }
        }
        throw new Error(msg || 'Verification failed');
      }
      setResult(data.result);
      toast({ title: 'Verified', description: `${label} verified successfully` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Verification Failed', description: e.message });
    } finally {
      setLoading(false);
      lock.current = false;
    }
  };

  const Row = ({ k, v }: { k: string; v?: string | null }) =>
    v ? (
      <div className="flex justify-between gap-4 py-2 border-b border-border last:border-0">
        <span className="text-sm text-muted-foreground">{k}</span>
        <span className="text-sm font-medium text-foreground text-right">{v}</span>
      </div>
    ) : null;

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => (result ? setResult(null) : navigate(-1))} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">BVN & NIN Verification</h1>
        </div>

        {result ? (
          <div className="px-4 pb-6">
            <div className="bg-card rounded-2xl border border-border p-5 text-center mb-4">
              {result.photo ? (
                <img src={`data:image/jpeg;base64,${result.photo}`} alt="Holder" className="w-28 h-28 rounded-full object-cover mx-auto mb-3 border-4 border-primary/20" />
              ) : (
                <div className="w-28 h-28 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center"><User className="w-12 h-12 text-muted-foreground" /></div>
              )}
              <p className="font-bold text-lg text-foreground">{result.personal_details.full_name}</p>
              <p className="text-sm text-primary flex items-center justify-center gap-1 mt-1">
                <CheckCircle2 className="w-4 h-4" /> {result.verification_type.toUpperCase()} Verified
              </p>
            </div>
            <div className="bg-card rounded-2xl border border-border px-4 py-2 mb-4">
              <Row k={result.verification_type.toUpperCase()} v={result.identity_number} />
              <Row k="First name" v={result.personal_details.first_name} />
              <Row k="Middle name" v={result.personal_details.middle_name} />
              <Row k="Last name" v={result.personal_details.last_name} />
              <Row k="Date of birth" v={result.personal_details.date_of_birth} />
              <Row k="Gender" v={result.personal_details.gender} />
              <Row k="Nationality" v={result.personal_details.nationality} />
              <Row k="Phone" v={result.contact_details.phone_number} />
              <Row k="Phone 2" v={result.contact_details.phone_number2} />
              <Row k="Email" v={result.contact_details.email} />
            </div>
            <p className="text-xs text-muted-foreground text-center mb-4">These details are shown once and are not stored in the app.</p>
            <Button className="w-full" size="lg" onClick={() => { setResult(null); setNumber(''); }}>New Verification</Button>
          </div>
        ) : (
          <div className="px-4 pb-6">
            <div className="mb-6">
              <Label className="mb-3 block">Verification Type</Label>
              <div className="grid grid-cols-2 gap-3">
                {(['bvn', 'nin'] as IdType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setVerificationType(t); setNumber(''); }}
                    className={`p-4 rounded-xl border-2 transition-all ${verificationType === t ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
                  >
                    {t === 'bvn' ? <CreditCard className="w-8 h-8 mx-auto mb-2 text-primary" /> : <Fingerprint className="w-8 h-8 mx-auto mb-2 text-primary" />}
                    <p className="font-medium text-center">{t.toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground text-center">{t === 'bvn' ? 'Bank Verification' : 'National ID'}</p>
                    {prices[t] && <p className="text-xs font-semibold text-primary text-center mt-1">₦{Number(prices[t].selling_price).toLocaleString()}</p>}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <Label htmlFor="number">{label} Number</Label>
              <Input
                id="number"
                inputMode="numeric"
                placeholder={`Enter ${label}`}
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">Enter the 11-digit {label} number</p>
            </div>

            <Button className="w-full" size="lg" onClick={start} disabled={loading || number.length !== 11}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : `Verify ${label}${price ? ` · ₦${Number(price.selling_price).toLocaleString()}` : ''}`}
            </Button>

            <div className="mt-6 bg-accent/10 rounded-xl p-4">
              <p className="text-sm text-foreground">
                <span className="font-medium">Note:</span> The fee is deducted from the wallet. If no record is found or the service fails, the full amount is refunded automatically.
              </p>
            </div>
          </div>
        )}
      </div>

      <TransactionPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        onComplete={() => { setPinOpen(false); runVerify(); }}
        mode="verify"
        title="Authorize Verification"
        description={`Pay ₦${price ? Number(price.selling_price).toLocaleString() : ''} for ${label} verification`}
      />
    </MobileLayout>
  );
}
