import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Fingerprint, Loader2 } from 'lucide-react';

interface Row { id_type: string; api_price: number; selling_price: number; is_active: boolean }

export function VerificationPricing() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('verification_prices').select('*').order('id_type').then(({ data }) => setRows((data as Row[]) || []));
  }, []);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((r) => r.map((x) => (x.id_type === id ? { ...x, ...patch } : x)));

  const save = async (row: Row) => {
    if (Number(row.selling_price) < Number(row.api_price)) {
      toast({ variant: 'destructive', title: 'Price too low', description: 'Selling price is below the API cost.' });
      return;
    }
    setSaving(row.id_type);
    const { error } = await supabase
      .from('verification_prices')
      .update({ selling_price: Number(row.selling_price), is_active: row.is_active, updated_at: new Date().toISOString() })
      .eq('id_type', row.id_type);
    setSaving(null);
    toast(error ? { variant: 'destructive', title: 'Error', description: error.message } : { title: 'Saved', description: `${row.id_type.toUpperCase()} price updated` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Fingerprint className="h-5 w-5" />BVN / NIN Pricing</CardTitle>
        <CardDescription>PaymentPoint cost vs. what users pay</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => (
          <div key={row.id_type} className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{row.id_type.toUpperCase()}</span>
              <div className="flex items-center gap-2 text-sm">
                Active <Switch checked={row.is_active} onCheckedChange={(v) => update(row.id_type, { is_active: v })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">API cost: ₦{row.api_price} · Profit: ₦{(Number(row.selling_price) - Number(row.api_price)).toFixed(2)}</p>
            <div className="flex gap-2">
              <Input type="number" value={row.selling_price} onChange={(e) => update(row.id_type, { selling_price: e.target.value as unknown as number })} />
              <Button onClick={() => save(row)} disabled={saving === row.id_type}>
                {saving === row.id_type && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
