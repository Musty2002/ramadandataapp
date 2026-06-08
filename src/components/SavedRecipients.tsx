import { X } from 'lucide-react';
import { SavedRecipient } from '@/hooks/useRecentRecipients';

interface SavedRecipientsProps {
  recipients: SavedRecipient[];
  onSelect: (phone: string) => void;
  onRemove: (phone: string) => void;
}

export function SavedRecipients({ recipients, onSelect, onRemove }: SavedRecipientsProps) {
  if (recipients.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground mb-2">Recent numbers</p>
      <div className="flex flex-wrap gap-2">
        {recipients.map((r) => (
          <div
            key={r.phone}
            className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-card border border-border shadow-sm"
          >
            <button
              type="button"
              onClick={() => onSelect(r.phone)}
              className="text-xs font-medium text-foreground"
            >
              {r.name ? (
                <span>
                  <span className="font-semibold">{r.name}</span>{' '}
                  <span className="text-muted-foreground">{r.phone}</span>
                </span>
              ) : (
                r.phone
              )}
            </button>
            <button
              type="button"
              onClick={() => onRemove(r.phone)}
              className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
              aria-label="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
