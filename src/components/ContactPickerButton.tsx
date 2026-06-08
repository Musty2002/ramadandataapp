import { Capacitor } from '@capacitor/core';
import { useCallback, useState } from 'react';
import { Contacts } from '@capacitor-community/contacts';
import { UserRound, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PickedContact {
  phone: string;
  name?: string;
}

interface ContactPickerButtonProps {
  onPick: (contact: PickedContact) => void;
  className?: string;
  label?: string;
}

/**
 * Normalize a Nigerian phone number to 11 digits starting with 0.
 * Accepts +234..., 234..., 0..., with spaces/dashes.
 */
function normalizeNigerianPhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;

  let local = digits;
  if (local.startsWith('234')) {
    local = '0' + local.slice(3);
  } else if (!local.startsWith('0') && local.length === 10) {
    local = '0' + local;
  }

  if (local.length === 11 && local.startsWith('0')) return local;
  return null;
}

export function ContactPickerButton({
  onPick,
  className = '',
  label = 'Contacts',
}: ContactPickerButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handlePick = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      toast({
        variant: 'destructive',
        title: 'Not available',
        description: 'Contact picker is only available on the mobile app.',
      });
      return;
    }

    setLoading(true);
    try {
      const permission = await Contacts.requestPermissions();
      if (permission.contacts !== 'granted') {
        toast({
          variant: 'destructive',
          title: 'Permission denied',
          description: 'Allow contacts permission to pick a number.',
        });
        return;
      }

      const result = await Contacts.pickContact({
        projection: { name: true, phones: true },
      });

      const phones = result?.contact?.phones ?? [];
      const name = result?.contact?.name?.display;

      if (!phones.length) {
        toast({
          variant: 'destructive',
          title: 'No phone number',
          description: 'The selected contact has no phone number.',
        });
        return;
      }

      // Try each phone number until we find a valid Nigerian one
      let normalized: string | null = null;
      for (const p of phones) {
        const n = normalizeNigerianPhone(p.number || '');
        if (n) {
          normalized = n;
          break;
        }
      }

      if (!normalized) {
        toast({
          variant: 'destructive',
          title: 'Invalid number',
          description: 'No valid Nigerian phone number found in this contact.',
        });
        return;
      }

      onPick({ phone: normalized, name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/cancel/i.test(msg)) {
        toast({
          variant: 'destructive',
          title: 'Could not open contacts',
          description: msg,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [onPick, toast]);

  return (
    <button
      type="button"
      onClick={handlePick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold active:scale-95 transition disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <UserRound className="w-3.5 h-3.5" />
      )}
      {label}
    </button>
  );
}
