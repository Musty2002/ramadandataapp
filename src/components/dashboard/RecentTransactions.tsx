import { useEffect, useState, useCallback } from 'react';
import { ArrowUpRight, ArrowDownLeft, ChevronRight, RefreshCw, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Transaction } from '@/types/database';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { withTimeout } from '@/lib/supabaseWithTimeout';

function cacheKey(userId: string) {
  return `recent_transactions_v1:${userId}`;
}

function readCache(userId: string): Transaction[] {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Transaction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCache(userId: string, txs: Transaction[]) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(txs));
  } catch {
    // ignore
  }
}

export function RecentTransactions({ refreshTick = 0 }: { refreshTick?: number }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const userId = user?.id;

  // Hydrate from cache so the UI stays stable after background WebView reloads
  useEffect(() => {
    if (!userId) return;
    const cached = readCache(userId);
    if (cached.length) {
      setTransactions(cached);
      setLoading(false);
      setError(null);
    }
  }, [userId]);

  const fetchTransactions = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    const hasExisting = transactions.length > 0;
    if (!hasExisting) setLoading(true);
    setError(null);
    
    try {
      // Create fresh query each time
      const fetchQuery = () => supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data, error: queryError } = await withTimeout(
        fetchQuery(),
        15000, // more forgiving on mobile
        'Connection timed out'
      );

      if (queryError) throw queryError;

      if (data) {
        const normalized = (data as any[]).map((row) => ({
          ...row,
          amount: Number(row.amount),
        }));
        const next = normalized as Transaction[];
        setTransactions(next);
        writeCache(userId, next);
        setError(null);
      }
    } catch (err) {
      console.error('[RecentTransactions] Fetch error:', err);
      const message = err instanceof Error ? err.message : 'Failed to load transactions';
      // If we already have cached transactions, keep showing them.
      if (transactions.length === 0) {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, transactions.length]);

  useEffect(() => {
    if (userId) {
      fetchTransactions();
    }
  }, [userId, refreshTick, fetchTransactions]);

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      deposit: 'Wallet Top Up',
      airtime: 'Airtime Purchase',
      data: 'Data Purchase',
      electricity: 'Electricity Bill',
      tv: 'TV Subscription',
      transfer: 'Transfer',
      referral_bonus: 'Referral Bonus',
    };
    return labels[category] || category;
  };

  const formatAmount = (amount: number, type: string) => {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
    return type === 'credit' ? `+${formatted}` : `-${formatted}`;
  };

  if (loading) {
    return (
      <div className="px-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Recent Transactions</h3>
        </div>
        <div className="bg-card rounded-xl p-6 text-center">
          <WifiOff className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            {error.includes('timed out') ? 'Slow connection' : 'Failed to load'}
          </p>
          <button
            onClick={fetchTransactions}
            className="text-sm text-primary flex items-center gap-1 mx-auto"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Recent Transactions</h3>
        <button
          onClick={() => navigate('/history')}
          className="text-xs text-accent flex items-center gap-1"
        >
          See all <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="bg-card rounded-xl p-4 flex items-center gap-3 shadow-sm"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  tx.type === 'credit'
                    ? 'bg-green-100 text-green-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {tx.type === 'credit' ? (
                  <ArrowDownLeft className="w-5 h-5" />
                ) : (
                  <ArrowUpRight className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {getCategoryLabel(tx.category)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(tx.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
              <span
                className={`text-sm font-semibold ${
                  tx.type === 'credit' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatAmount(tx.amount, tx.type)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}