import { useCallback, useEffect, useState } from 'react';

const MAX_RECIPIENTS = 6;

export interface SavedRecipient {
  phone: string;
  name?: string;
  lastUsedAt: number;
}

const keyFor = (service: string) => `recent_recipients_${service}`;

function read(service: string): SavedRecipient[] {
  try {
    const raw = localStorage.getItem(keyFor(service));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => r && typeof r.phone === 'string');
  } catch {
    return [];
  }
}

function write(service: string, list: SavedRecipient[]) {
  try {
    localStorage.setItem(keyFor(service), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/**
 * Stores recent recipient phone numbers per service in localStorage.
 * service: 'airtime' | 'data' | etc.
 */
export function useRecentRecipients(service: string) {
  const [recipients, setRecipients] = useState<SavedRecipient[]>([]);

  useEffect(() => {
    setRecipients(read(service));
  }, [service]);

  const saveRecipient = useCallback(
    (phone: string, name?: string) => {
      const clean = phone.replace(/\D/g, '');
      if (!clean) return;
      const current = read(service);
      const filtered = current.filter((r) => r.phone !== clean);
      const next: SavedRecipient[] = [
        { phone: clean, name, lastUsedAt: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECIPIENTS);
      write(service, next);
      setRecipients(next);
    },
    [service],
  );

  const removeRecipient = useCallback(
    (phone: string) => {
      const next = read(service).filter((r) => r.phone !== phone);
      write(service, next);
      setRecipients(next);
    },
    [service],
  );

  return { recipients, saveRecipient, removeRecipient };
}
