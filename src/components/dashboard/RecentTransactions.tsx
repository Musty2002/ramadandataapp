import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Transaction } from '@/types/database';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export function RecentTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      setTransactions(data as Transaction[]);
    }
    setLoading(false);
  };

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