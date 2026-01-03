import { useEffect, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowUpRight, ArrowDownLeft, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Transaction, TransactionCategory } from '@/types/database';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

const categoryFilters: { label: string; value: TransactionCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Data', value: 'data' },
  { label: 'Airtime', value: 'airtime' },
  { label: 'Bills', value: 'electricity' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Deposit', value: 'deposit' },
  { label: 'Referral', value: 'referral_bonus' },
];

export default function History() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TransactionCategory | 'all'>('all');

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user, filter]);

  const fetchTransactions = async () => {
    setLoading(true);
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('category', filter);
    }

    const { data } = await query;
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

  const groupTransactionsByDate = (txs: Transaction[]) => {
    const groups: Record<string, Transaction[]> = {};
    txs.forEach((tx) => {
      const date = format(new Date(tx.created_at), 'MMM d, yyyy');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(tx);
    });
    return groups;
  };

  const groupedTransactions = groupTransactionsByDate(transactions);

  return (
    <MobileLayout>
      <div className="safe-area-top px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">Transaction History</h1>
          <Button variant="outline" size="icon" className="h-9 w-9">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar">
          {categoryFilters.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-foreground border border-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTransactions).map(([date, txs]) => (
              <div key={date}>
                <p className="text-xs font-medium text-muted-foreground mb-2">{date}</p>
                <div className="space-y-2">
                  {txs.map((tx) => (
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
                          {format(new Date(tx.created_at), 'h:mm a')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-sm font-semibold ${
                            tx.type === 'credit' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatAmount(tx.amount, tx.type)}
                        </span>
                        <p className={`text-xs ${
                          tx.status === 'completed' ? 'text-green-600' : 
                          tx.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {tx.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}